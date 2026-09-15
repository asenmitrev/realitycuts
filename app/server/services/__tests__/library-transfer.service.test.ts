import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { LibraryTransferService } from '../library-transfer.service';
import { UserProfile } from '../../models/user-profile';
import { LibraryExportJob } from '../../models/library-export-job';
import { uploadPrivateFileToS3 } from '../storage/s3';
import { enqueueLibraryImportTask } from '../task-queue';
import { LIBRARY_EXPORT_FORMAT, LIBRARY_EXPORT_VERSION } from 'shared/types/library-export';

vi.mock('fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
      unlink: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      rm: vi.fn().mockResolvedValue(undefined)
    },
    createWriteStream: vi.fn()
  }
}));

vi.mock('../../models/user-profile', () => ({
  UserProfile: { findOne: vi.fn() }
}));

vi.mock('../../models/library-export-job', () => ({
  LibraryExportJob: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn()
  }
}));

vi.mock('../../models/library', () => ({ Library: { create: vi.fn(), deleteOne: vi.fn() } }));
vi.mock('../../models/library-upload', () => ({ LibraryUpload: { create: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('../../models/broll-video-metadata', () => ({
  BrollFootageMetadata: { create: vi.fn(), deleteMany: vi.fn() }
}));

vi.mock('../storage/s3', () => ({
  getObjectStream: vi.fn(),
  uploadPrivateFileToS3: vi.fn().mockResolvedValue(undefined),
  uploadReadableToS3: vi.fn(),
  deleteFromS3Promise: vi.fn().mockResolvedValue(undefined),
  deleteS3Prefix: vi.fn().mockResolvedValue(0)
}));

vi.mock('../task-queue', () => ({
  enqueueLibraryImportTask: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../logging', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

describe('LibraryTransferService.startImport', () => {
  const service = new LibraryTransferService();
  const userId = 'user-123';

  const baseManifest = {
    format: LIBRARY_EXPORT_FORMAT,
    version: LIBRARY_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    source: { environment: 'prod', libraryId: 'lib-1', userId: 'other-user' },
    library: { title: 'My Library', isPublic: false },
    uploads: [],
    brolls: [],
    stats: { brollCount: 0, uploadCount: 0, fileCount: 0, totalMediaBytes: 0, missingFiles: [], totalParts: 2 }
  };

  const manifestFile = (originalName = 'my-library-export-manifest.json') => ({
    path: `/tmp/data/${originalName}`,
    originalName
  });
  const partFile = (n: number) => ({
    path: `/tmp/data/my-library-export-part${n}.zip`,
    originalName: `my-library-export-part${n}.zip`
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (UserProfile.findOne as any).mockResolvedValue({ firebaseId: userId });
    (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(baseManifest));
    (LibraryExportJob.create as any).mockImplementation(async (doc: any) => ({
      ...doc,
      _id: 'job-1',
      save: vi.fn().mockResolvedValue(undefined)
    }));
  });

  it('rejects when the manifest is missing', async () => {
    const files = [partFile(1), partFile(2)];

    await expect(service.startImport(files, userId)).rejects.toThrow(
      'No manifest .json file found in the uploaded backup.'
    );
    expect(LibraryExportJob.create).not.toHaveBeenCalled();
    // Every uploaded file gets cleaned up even though nothing was a valid manifest.
    expect(fs.promises.unlink).toHaveBeenCalledWith(files[0].path);
    expect(fs.promises.unlink).toHaveBeenCalledWith(files[1].path);
  });

  it('rejects when a declared part is missing, listing the missing 1-based part number', async () => {
    const files = [manifestFile(), partFile(1)]; // manifest declares totalParts: 2, part2 absent

    await expect(service.startImport(files, userId)).rejects.toThrow('Missing backup part: 2');
    expect(LibraryExportJob.create).not.toHaveBeenCalled();
    expect(uploadPrivateFileToS3).not.toHaveBeenCalled();
  });

  it('lists every missing part when more than one is absent', async () => {
    const manifest = { ...baseManifest, stats: { ...baseManifest.stats, totalParts: 4 } };
    (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(manifest));
    const files = [manifestFile(), partFile(2)]; // parts 1, 3, 4 missing

    await expect(service.startImport(files, userId)).rejects.toThrow('Missing backup parts: 1, 3, 4');
  });

  it('matches part files by filename regardless of upload order and uploads each to its 0-based key', async () => {
    // Parts arrive out of order, plus an unrelated stray file that should just be discarded.
    const files = [partFile(2), manifestFile(), partFile(1), { path: '/tmp/data/readme.txt', originalName: 'readme.txt' }];

    const job = await service.startImport(files, userId);

    expect(job._id).toBe('job-1');
    expect(uploadPrivateFileToS3).toHaveBeenCalledWith(
      manifestFile().path,
      'library-imports/job-1/manifest.json',
      'application/json'
    );
    // part1.zip (1-based) -> index 0, part2.zip -> index 1
    expect(uploadPrivateFileToS3).toHaveBeenCalledWith(partFile(1).path, 'library-imports/job-1/part0.zip', 'application/zip');
    expect(uploadPrivateFileToS3).toHaveBeenCalledWith(partFile(2).path, 'library-imports/job-1/part1.zip', 'application/zip');
    expect(fs.promises.unlink).toHaveBeenCalledWith('/tmp/data/readme.txt');
    expect(enqueueLibraryImportTask).toHaveBeenCalledWith({ jobId: 'job-1', version: '1.0.0' });
  });

  it('rejects a manifest whose format does not match the library export contract', async () => {
    (fs.promises.readFile as any).mockResolvedValue(JSON.stringify({ ...baseManifest, format: 'something-else' }));
    const files = [manifestFile(), partFile(1), partFile(2)];

    await expect(service.startImport(files, userId)).rejects.toThrow('This is not a valid library export manifest.');
  });
});
