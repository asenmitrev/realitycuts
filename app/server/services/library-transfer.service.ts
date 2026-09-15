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
  deleteFromS3Promise,
  deleteS3Prefix
} from './storage/s3';
import { getS3FileUrl, S3_BUCKET } from '../config/storage';
import { enqueueLibraryImportTask } from './task-queue';
import { logger } from './logging';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../errors';
import {
  LIBRARY_EXPORT_FORMAT,
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

export class LibraryTransferService {
  /**
   * Stash the uploaded ZIP (already saved to local disk by multer) in MinIO under a
   * temp key and enqueue a BullMQ job to process it. The temp key — not the local
   * path — travels with the job, because a BullMQ worker may pick the job up after a
   * server restart, on a process that never saw the multer-written file.
   */
  async startImport(zipFilePath: string, originalFileName: string, userId: string): Promise<LibraryTransferJobData> {
    const userProfile = await UserProfile.findOne({ firebaseId: userId });
    if (!userProfile) {
      await fs.promises.unlink(zipFilePath).catch(() => {});
      throw new NotFoundError('User profile not found');
    }

    const job = await LibraryExportJob.create({
      direction: 'IMPORT',
      userId,
      status: 'QUEUED',
      fileName: originalFileName
    });

    const tempZipKey = `library-imports/${job._id}.zip`;
    try {
      await uploadPrivateFileToS3(zipFilePath, tempZipKey, 'application/zip');
    } catch (error) {
      await LibraryExportJob.findByIdAndUpdate(job._id, {
        status: 'FAILED',
        error: 'Failed to store the uploaded backup file.'
      });
      throw error;
    } finally {
      await fs.promises.unlink(zipFilePath).catch(() => {});
    }

    job.zipS3Key = tempZipKey;
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
        if (job.zipS3Key) {
          await deleteFromS3Promise(job.zipS3Key).catch(() => {});
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

    const tmpZipPath = path.join(os.tmpdir(), `library-import-${jobId}-${uuidv4()}.zip`);
    let newLibrary: InstanceType<typeof Library> | null = null;
    let openZipfile: ZipFile | null = null;

    try {
      job.status = 'PROCESSING';
      await job.save();

      if (!job.zipS3Key) {
        throw new BadRequestError('Import job has no backup file associated with it.');
      }

      await this.downloadZipFromS3(job.zipS3Key, tmpZipPath);

      const manifest = await this.readManifestFromZip(tmpZipPath);
      if (manifest.format !== LIBRARY_EXPORT_FORMAT) {
        throw new BadRequestError('This file is not a valid library export.');
      }

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

      const entryByPath = await this.readAllEntries(tmpZipPath);
      openZipfile = entryByPath.zipfile;
      const totalItems = manifest.uploads.length + manifest.brolls.length || 1;
      let processedItems = 0;
      const processedFiles: { link: string; prompt: string; status: 'PROCESSED' }[] = [];

      for (const upload of manifest.uploads) {
        let url: string | undefined;
        let s3Key: string | undefined;

        if (upload.file) {
          const entry = entryByPath.entries.get(upload.file.path);
          if (entry) {
            const timestamp = Date.now();
            s3Key = `users/${job.userId}/library/${newLibrary._id}/raw/${timestamp}-${upload.originalName}`;
            const stream = await this.openEntryStream(entryByPath.zipfile, entry);
            await uploadReadableToS3(stream, s3Key, {
              contentLength: entry.uncompressedSize,
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
          const entry = entryByPath.entries.get(fileRef.path);
          if (!entry) continue;

          const ext = path.extname(fileRef.path) || '';
          const s3Key = `users/${job.userId}/library/${newLibrary._id}/broll/${newBrollId}/${role}${ext}`;
          const stream = await this.openEntryStream(entryByPath.zipfile, entry);
          await uploadReadableToS3(stream, s3Key, {
            contentLength: entry.uncompressedSize,
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
      openZipfile?.close();
      await fs.promises.unlink(tmpZipPath).catch(() => {});
      if (job.zipS3Key) {
        await deleteFromS3Promise(job.zipS3Key).catch(() => {});
      }
    }
  }

  private async downloadZipFromS3(s3Key: string, destPath: string): Promise<void> {
    const { body } = await getObjectStream(s3Key);
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await pipeline(body as Readable, fs.createWriteStream(destPath));
  }

  private readManifestFromZip(zipFilePath: string): Promise<LibraryExportManifest> {
    return new Promise((resolve, reject) => {
      yauzl.open(zipFilePath, { lazyEntries: true, autoClose: false }, (err, zipfile) => {
        if (err || !zipfile) return reject(err ?? new BadRequestError('Could not open the uploaded ZIP file.'));

        let found = false;
        zipfile.on('entry', (entry: Entry) => {
          if (entry.fileName !== 'manifest.json') {
            zipfile.readEntry();
            return;
          }
          found = true;
          zipfile.openReadStream(entry, (streamErr, stream) => {
            if (streamErr || !stream) {
              zipfile.close();
              return reject(streamErr ?? new BadRequestError('Could not read manifest.json'));
            }
            const chunks: Buffer[] = [];
            stream.on('data', chunk => chunks.push(chunk as Buffer));
            stream.on('end', () => {
              zipfile.close();
              try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
              } catch (parseErr) {
                reject(new BadRequestError('manifest.json is not valid JSON.'));
              }
            });
            stream.on('error', streamErr2 => {
              zipfile.close();
              reject(streamErr2);
            });
          });
        });
        zipfile.on('end', () => {
          if (!found) {
            zipfile.close();
            reject(new BadRequestError('This file does not contain a manifest.json — not a valid library export.'));
          }
        });
        zipfile.on('error', reject);
        zipfile.readEntry();
      });
    });
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
