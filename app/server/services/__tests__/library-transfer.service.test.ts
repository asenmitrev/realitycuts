import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LibraryTransferService } from '../library-transfer.service';
import { UserProfile } from '../../models/user-profile';
import { LibraryExportJob } from '../../models/library-export-job';
import { putPrivateObjectString, generatePresignedUploadUrl, verifyS3Upload } from '../storage/s3';
import { enqueueLibraryImportTask } from '../task-queue';
import { LIBRARY_EXPORT_FORMAT, LIBRARY_EXPORT_VERSION } from 'shared/types/library-export';

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
  putPrivateObjectString: vi.fn().mockResolvedValue(undefined),
  uploadReadableToS3: vi.fn(),
  deleteS3Prefix: vi.fn().mockResolvedValue(0),
  generatePresignedUploadUrl: vi.fn().mockImplementation(async (key: string) => `https://minio.local/${key}?signed=1`),
  verifyS3Upload: vi.fn().mockResolvedValue({ exists: true })
}));

vi.mock('../task-queue', () => ({
  enqueueLibraryImportTask: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../logging', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

describe('LibraryTransferService', () => {
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
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (UserProfile.findOne as any).mockResolvedValue({ firebaseId: userId });
    (LibraryExportJob.create as any).mockImplementation(async (doc: any) => ({
      ...doc,
      _id: 'job-1',
      save: vi.fn().mockResolvedValue(undefined)
    }));
  });

  describe('initImport', () => {
    it('rejects a manifest whose format does not match the library export contract', async () => {
      await expect(service.initImport({ ...baseManifest, format: 'something-else' }, userId)).rejects.toThrow(
        'This is not a valid library export manifest.'
      );
      expect(LibraryExportJob.create).not.toHaveBeenCalled();
    });

    it('creates an AWAITING_UPLOAD job, stores the manifest, and returns one presigned URL per part', async () => {
      const result = await service.initImport(baseManifest, userId);

      expect(LibraryExportJob.create).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'IMPORT', status: 'AWAITING_UPLOAD', expectedParts: 2 })
      );
      expect(putPrivateObjectString).toHaveBeenCalledWith(
        'library-imports/job-1/manifest.json',
        JSON.stringify(baseManifest),
        'application/json'
      );
      expect(generatePresignedUploadUrl).toHaveBeenCalledWith(
        'library-imports/job-1/part0.zip',
        'application/zip',
        expect.any(Number)
      );
      expect(generatePresignedUploadUrl).toHaveBeenCalledWith(
        'library-imports/job-1/part1.zip',
        'application/zip',
        expect.any(Number)
      );
      expect(result).toEqual({
        jobId: 'job-1',
        partUploadUrls: [
          'https://minio.local/library-imports/job-1/part0.zip?signed=1',
          'https://minio.local/library-imports/job-1/part1.zip?signed=1'
        ]
      });
    });

    it('returns no part URLs when the manifest declares zero parts', async () => {
      const result = await service.initImport({ ...baseManifest, stats: { ...baseManifest.stats, totalParts: 0 } }, userId);
      expect(result.partUploadUrls).toEqual([]);
      expect(generatePresignedUploadUrl).not.toHaveBeenCalled();
    });
  });

  describe('finalizeImport', () => {
    const awaitingUploadJob = () => ({
      _id: 'job-1',
      userId,
      status: 'AWAITING_UPLOAD',
      expectedParts: 2,
      importS3Prefix: 'library-imports/job-1',
      save: vi.fn().mockResolvedValue(undefined)
    });

    it('rejects when the job is not awaiting upload', async () => {
      (LibraryExportJob.findById as any).mockResolvedValue({ ...awaitingUploadJob(), status: 'PROCESSING' });

      await expect(service.finalizeImport('job-1', userId)).rejects.toThrow('not awaiting upload');
      expect(enqueueLibraryImportTask).not.toHaveBeenCalled();
    });

    it('rejects when a part is missing, listing its 1-based number', async () => {
      (LibraryExportJob.findById as any).mockResolvedValue(awaitingUploadJob());
      (verifyS3Upload as any).mockImplementation(async (key: string) =>
        key.endsWith('part1.zip') ? { exists: false } : { exists: true }
      );

      await expect(service.finalizeImport('job-1', userId)).rejects.toThrow('Missing backup part: 2');
      expect(enqueueLibraryImportTask).not.toHaveBeenCalled();
    });

    it('lists every missing part when more than one is absent', async () => {
      (LibraryExportJob.findById as any).mockResolvedValue({ ...awaitingUploadJob(), expectedParts: 3 });
      (verifyS3Upload as any).mockResolvedValue({ exists: false });

      await expect(service.finalizeImport('job-1', userId)).rejects.toThrow('Missing backup parts: 1, 2, 3');
    });

    it('marks the job QUEUED and enqueues the import task once every part is present', async () => {
      const job = awaitingUploadJob();
      (LibraryExportJob.findById as any).mockResolvedValue(job);
      (verifyS3Upload as any).mockResolvedValue({ exists: true });

      const result = await service.finalizeImport('job-1', userId);

      expect(job.status).toBe('QUEUED');
      expect(job.save).toHaveBeenCalled();
      expect(enqueueLibraryImportTask).toHaveBeenCalledWith({ jobId: 'job-1', version: '1.0.0' });
      expect(result.status).toBe('QUEUED');
    });
  });
});
