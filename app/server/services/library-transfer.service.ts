import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';
import mongoose from 'mongoose';
import yauzl, { Entry, ZipFile } from 'yauzl';
import { v4 as uuidv4 } from 'uuid';
import { Library } from '../models/library';
import { LibraryUpload } from '../models/library-upload';
import { BrollFootageMetadata } from '../models/broll-video-metadata';
import { LibraryExportJob } from '../models/library-export-job';
import { UserProfile } from '../models/user-profile';
import {
  getObjectStream,
  uploadPrivateFileToS3,
  uploadReadableToS3,
  deleteS3Prefix
} from './storage/s3';
import { getS3FileUrl, S3_BUCKET } from '../config/storage';
import { enqueueLibraryImportTask } from './task-queue';
import { logger } from './logging';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../errors';
import {
  LIBRARY_EXPORT_FORMAT,
  LIBRARY_EXPORT_PART_FILENAME_REGEX,
  LIBRARY_EXPORT_LEGACY_PART_FILENAME_REGEX,
  LibraryExportManifest,
  LibraryTransferJobData
} from 'shared/types/library-export';

const BROLL_FILE_ROLES = {
  video: 'url',
  thumbnail: 'thumbnailUrl',
  thumbnail2: 'thumbnailUrl2',
  preview: 'preview',
  image: 'imageUrl'
} as const;

type BrollFileRole = keyof typeof BROLL_FILE_ROLES;

/** A file multer already saved to local disk, part of an uploaded backup. */
type UploadedBackupFile = { path: string; originalName: string };

/**
 * Match a backup file's original name against the current (0-based, part-{n}.zip) and
 * legacy (1-based, <name>-export-part{n}.zip) part filename conventions, returning the
 * part's 0-based index, or null if the name matches neither.
 */
function matchPartIndex(originalName: string): number | null {
  const current = LIBRARY_EXPORT_PART_FILENAME_REGEX.exec(originalName);
  if (current) return parseInt(current[1], 10);

  const legacy = LIBRARY_EXPORT_LEGACY_PART_FILENAME_REGEX.exec(originalName);
  if (legacy) return parseInt(legacy[1], 10) - 1;

  return null;
}

export class LibraryTransferService {
  /**
   * Stash the uploaded backup (manifest.json + one or more part ZIPs, already saved to
   * local disk by multer) in MinIO under a temp prefix and enqueue a BullMQ job to
   * process it. The S3 prefix — not the local paths — travels with the job, because a
   * BullMQ worker may pick the job up after a server restart, on a process that never
   * saw the multer-written files.
   */
  async startImport(files: UploadedBackupFile[], userId: string): Promise<LibraryTransferJobData> {
    const cleanupLocalFiles = () => Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));

    const userProfile = await UserProfile.findOne({ firebaseId: userId });
    if (!userProfile) {
      await cleanupLocalFiles();
      throw new NotFoundError('User profile not found');
    }

    const manifestFile = files.find(file => file.originalName.toLowerCase().endsWith('.json'));
    if (!manifestFile) {
      await cleanupLocalFiles();
      throw new BadRequestError('No manifest .json file found in the uploaded backup.');
    }

    let manifest: LibraryExportManifest;
    try {
      const manifestRaw = await fs.promises.readFile(manifestFile.path, 'utf8');
      manifest = JSON.parse(manifestRaw);
    } catch {
      await cleanupLocalFiles();
      throw new BadRequestError('This is not a valid library export manifest.');
    }
    if (manifest.format !== LIBRARY_EXPORT_FORMAT) {
      await cleanupLocalFiles();
      throw new BadRequestError('This is not a valid library export manifest.');
    }

    const partFileByIndex = new Map<number, UploadedBackupFile>();
    for (const file of files) {
      if (file === manifestFile) continue;
      const index = matchPartIndex(file.originalName);
      if (index !== null) partFileByIndex.set(index, file);
      // Anything that matches neither the manifest nor a part filename convention is a
      // stray upload — it's simply left out of partFileByIndex and unlinked below.
    }

    const totalParts = manifest.stats?.totalParts ?? 0;
    const missingParts: number[] = [];
    for (let index = 0; index < totalParts; index++) {
      if (!partFileByIndex.has(index)) missingParts.push(index + 1);
    }
    if (missingParts.length === 1) {
      await cleanupLocalFiles();
      throw new BadRequestError(`Missing backup part: ${missingParts[0]}`);
    }
    if (missingParts.length > 1) {
      await cleanupLocalFiles();
      throw new BadRequestError(`Missing backup parts: ${missingParts.join(', ')}`);
    }

    const job = await LibraryExportJob.create({
      direction: 'IMPORT',
      userId,
      status: 'QUEUED',
      fileName: manifestFile.originalName
    });

    const s3Prefix = `library-imports/${job._id}`;
    try {
      await uploadPrivateFileToS3(manifestFile.path, `${s3Prefix}/manifest.json`, 'application/json');
      for (const [index, file] of partFileByIndex) {
        await uploadPrivateFileToS3(file.path, `${s3Prefix}/part${index}.zip`, 'application/zip');
      }
    } catch (error) {
      await LibraryExportJob.findByIdAndUpdate(job._id, {
        status: 'FAILED',
        error: 'Failed to store the uploaded backup files.'
      });
      throw error;
    } finally {
      await cleanupLocalFiles();
    }

    job.importS3Prefix = s3Prefix;
    await job.save();

    await enqueueLibraryImportTask({ jobId: job._id!.toString(), version: '1.0.0' });

    return this.toJobData(job);
  }

  /**
   * Poll the status of an import job. Only the owner can read it.
   */
  async getJobStatus(jobId: string, userId: string): Promise<LibraryTransferJobData> {
    const job = await LibraryExportJob.findById(jobId);
    if (!job) {
      throw new NotFoundError('Transfer job not found');
    }
    if (job.userId !== userId) {
      throw new UnauthorizedError('You do not have permission to access this job');
    }

    return this.toJobData(job);
  }

  /**
   * Called at server boot. Any import job left QUEUED/PROCESSING was orphaned by a
   * worker restart mid-job — fail it, clean up the partial library, and delete the
   * temp ZIP it was working from.
   */
  async cleanupStaleImportJobs(): Promise<void> {
    const staleJobs = await LibraryExportJob.find({ direction: 'IMPORT', status: { $in: ['QUEUED', 'PROCESSING'] } });
    for (const job of staleJobs) {
      try {
        if (job.newLibraryId) {
          await this.cleanupPartialImport(job.newLibraryId.toString(), job.userId);
        }
        if (job.importS3Prefix) {
          await deleteS3Prefix(`${job.importS3Prefix}/`).catch(() => {});
        }
        job.status = 'FAILED';
        job.error = 'Interrupted by a server restart';
        await job.save();
      } catch (err) {
        logger.error('Failed to clean up stale library import job', { Error: err, 'Job ID': job._id.toString() });
      }
    }
  }

  // ---------------------------------------------------------------------
  // IMPORT — invoked by the BullMQ worker (see bullmq/library-import-processor.ts)
  // ---------------------------------------------------------------------

  async processImport(jobId: string): Promise<void> {
    const job = await LibraryExportJob.findById(jobId);
    if (!job) return;

    const tmpDir = path.join(os.tmpdir(), `library-import-${jobId}-${uuidv4()}`);
    let newLibrary: InstanceType<typeof Library> | null = null;
    const openParts = new Map<number, { zipfile: ZipFile; entries: Map<string, Entry> }>();

    try {
      job.status = 'PROCESSING';
      await job.save();

      if (!job.importS3Prefix) {
        throw new BadRequestError('Import job has no backup files associated with it.');
      }

      const manifest = await this.downloadManifestFromS3(`${job.importS3Prefix}/manifest.json`);
      if (manifest.format !== LIBRARY_EXPORT_FORMAT) {
        throw new BadRequestError('This file is not a valid library export.');
      }

      const totalParts = manifest.stats?.totalParts ?? 0;
      for (let index = 0; index < totalParts; index++) {
        const partZipPath = path.join(tmpDir, `part${index}.zip`);
        await this.downloadFileFromS3(`${job.importS3Prefix}/part${index}.zip`, partZipPath);
        openParts.set(index, await this.readAllEntries(partZipPath));
      }
      const getEntry = (fileRef: { part: number; path: string }): { zipfile: ZipFile; entry: Entry } | null => {
        const part = openParts.get(fileRef.part);
        const entry = part?.entries.get(fileRef.path);
        return part && entry ? { zipfile: part.zipfile, entry } : null;
      };

      newLibrary = await Library.create({
        userId: job.userId,
        title: manifest.library.title ? `${manifest.library.title} (imported)` : 'Imported library',
        description: manifest.library.description,
        isPublic: false,
        tags: manifest.library.tags ?? [],
        clusteringMetadata: manifest.library.clusteringMetadata,
        status: 'PROCESSING',
        processedFiles: []
      });

      job.newLibraryId = newLibrary._id as any;
      await job.save();

      const totalItems = manifest.uploads.length + manifest.brolls.length || 1;
      let processedItems = 0;
      const processedFiles: { link: string; prompt: string; status: 'PROCESSED' }[] = [];

      for (const upload of manifest.uploads) {
        let url: string | undefined;
        let s3Key: string | undefined;

        // videoai's export never packs raw upload media (upload.file is always null there) —
        // the branch below only still fires for legacy backups that did include it. Either
        // way, no `file` here correctly falls through to uploadStatus: 'FAILED' below.
        if (upload.file) {
          const found = getEntry(upload.file);
          if (found) {
            const timestamp = Date.now();
            s3Key = `users/${job.userId}/library/${newLibrary._id}/raw/${timestamp}-${upload.originalName}`;
            const stream = await this.openEntryStream(found.zipfile, found.entry);
            await uploadReadableToS3(stream, s3Key, {
              contentLength: found.entry.uncompressedSize,
              mimeType: upload.mimeType,
              publicRead: true
            });
            url = getS3FileUrl(s3Key);
          }
        }

        const newUpload = await LibraryUpload.create({
          libraryId: newLibrary._id,
          fileName: s3Key ? path.basename(s3Key) : upload.originalName,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          s3Key: s3Key ?? `missing/${uuidv4()}`,
          s3Bucket: S3_BUCKET,
          originalName: upload.originalName,
          url,
          uploadStatus: s3Key ? 'COMPLETED' : 'FAILED',
          duration: upload.duration
        });

        if (upload.prompt) {
          processedFiles.push({ link: newUpload._id!.toString(), prompt: upload.prompt, status: 'PROCESSED' });
        }

        processedItems++;
        await this.maybeUpdateProgress(job, processedItems, totalItems);
      }

      for (const broll of manifest.brolls) {
        const newBrollId = new mongoose.Types.ObjectId();
        const urls: Record<string, string> = {};

        for (const role of Object.keys(BROLL_FILE_ROLES) as BrollFileRole[]) {
          const fileRef = broll.files[role];
          if (!fileRef) continue;
          const found = getEntry(fileRef);
          if (!found) continue;

          const ext = path.extname(fileRef.path) || '';
          const s3Key = `users/${job.userId}/library/${newLibrary._id}/broll/${newBrollId}/${role}${ext}`;
          const stream = await this.openEntryStream(found.zipfile, found.entry);
          await uploadReadableToS3(stream, s3Key, {
            contentLength: found.entry.uncompressedSize,
            mimeType: fileRef.mimeType,
            publicRead: true
          });
          urls[BROLL_FILE_ROLES[role]] = getS3FileUrl(s3Key);
        }

        if (!urls.thumbnailUrl && urls.thumbnailUrl2) {
          // Some exports only ever generated the secondary thumbnail — reuse it as the
          // primary so the library UI (which only reads thumbnailUrl) has something to show.
          urls.thumbnailUrl = urls.thumbnailUrl2;
        }

        if (Object.keys(urls).length === 0) {
          // Every file for this broll was missing from the ZIP — nothing worth importing.
          processedItems++;
          continue;
        }

        await BrollFootageMetadata.create({
          ...broll.data,
          _id: newBrollId,
          libraryId: newLibrary._id,
          isPublic: false,
          ...urls
        });

        processedItems++;
        await this.maybeUpdateProgress(job, processedItems, totalItems);
      }

      newLibrary.processedFiles = processedFiles as any;
      newLibrary.status = 'PROCESSED';
      newLibrary.progress = 100;
      await newLibrary.save();

      job.status = 'COMPLETED';
      job.progress = 1;
      job.stats = {
        brollCount: manifest.brolls.length,
        uploadCount: manifest.uploads.length,
        sourceEnvironment: manifest.source.environment,
        sourceExportedAt: manifest.exportedAt
      };
      await job.save();
    } catch (error) {
      logger.error('Library import failed', { Error: error, 'Job ID': jobId });
      if (newLibrary?._id) {
        await this.cleanupPartialImport(newLibrary._id.toString(), job.userId).catch(() => {});
      }
      await LibraryExportJob.findByIdAndUpdate(jobId, {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Import failed'
      });
    } finally {
      for (const { zipfile } of openParts.values()) zipfile.close();
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      if (job.importS3Prefix) {
        await deleteS3Prefix(`${job.importS3Prefix}/`).catch(() => {});
      }
    }
  }

  private async downloadFileFromS3(s3Key: string, destPath: string): Promise<void> {
    const { body } = await getObjectStream(s3Key);
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await pipeline(body as Readable, fs.createWriteStream(destPath));
  }

  private async downloadManifestFromS3(s3Key: string): Promise<LibraryExportManifest> {
    const { body } = await getObjectStream(s3Key);
    const chunks: Buffer[] = [];
    for await (const chunk of body as Readable) {
      chunks.push(chunk as Buffer);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new BadRequestError('manifest.json is not valid JSON.');
    }
  }

  private readAllEntries(zipFilePath: string): Promise<{ zipfile: ZipFile; entries: Map<string, Entry> }> {
    return new Promise((resolve, reject) => {
      yauzl.open(zipFilePath, { lazyEntries: true, autoClose: false }, (err, zipfile) => {
        if (err || !zipfile) return reject(err ?? new BadRequestError('Could not open the uploaded ZIP file.'));

        const entries = new Map<string, Entry>();
        zipfile.on('entry', (entry: Entry) => {
          if (!entry.fileName.endsWith('/')) entries.set(entry.fileName, entry);
          zipfile.readEntry();
        });
        zipfile.on('end', () => resolve({ zipfile, entries }));
        zipfile.on('error', reject);
        zipfile.readEntry();
      });
    });
  }

  private openEntryStream(zipfile: ZipFile, entry: Entry): Promise<Readable> {
    return new Promise((resolve, reject) => {
      zipfile.openReadStream(entry, (err, stream) => {
        if (err || !stream) return reject(err ?? new Error('Could not open zip entry stream'));
        resolve(stream);
      });
    });
  }

  private async cleanupPartialImport(libraryId: string, userId: string): Promise<void> {
    await BrollFootageMetadata.deleteMany({ libraryId });
    await LibraryUpload.deleteMany({ libraryId });
    await Library.deleteOne({ _id: libraryId });
    await deleteS3Prefix(`users/${userId}/library/${libraryId}/`);
  }

  private async maybeUpdateProgress(
    job: InstanceType<typeof LibraryExportJob>,
    processed: number,
    total: number
  ): Promise<void> {
    if (processed !== total && processed % 5 !== 0) return;
    job.progress = Math.min(0.99, processed / total);
    await job.save();
  }

  private toJobData(job: InstanceType<typeof LibraryExportJob>): LibraryTransferJobData {
    return {
      _id: job._id!.toString(),
      direction: job.direction,
      userId: job.userId,
      sourceLibraryId: job.sourceLibraryId?.toString() ?? null,
      newLibraryId: job.newLibraryId?.toString() ?? null,
      status: job.status,
      error: job.error,
      progress: job.progress,
      stats: job.stats,
      // Import never produces a downloadable artifact — only EXPORT (not implemented on
      // this branch) would populate this.
      downloadUrl: null,
      fileName: job.fileName,
      createdAt: job.createdAt?.toISOString(),
      updatedAt: job.updatedAt?.toISOString()
    };
  }
}

export const libraryTransferService = new LibraryTransferService();
export default libraryTransferService;
