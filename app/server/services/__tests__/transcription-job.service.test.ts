import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { TranscriptionJobService } from '../transcription-job.service';
import transcriptionJobRepository from '../../repositories/transcription-job.repository';
import { UserProfile } from '../../models/user-profile';
import { deleteFromS3 } from '../../services/storage/s3';
import { safelyDelete } from '../../services/fs';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../errors';
import { ITranscriptionJob } from '../../types';

// Mock dependencies
vi.mock('../../repositories/transcription-job.repository', () => ({
  default: {
    findById: vi.fn(),
    findJobs: vi.fn(),
    update: vi.fn(),
    save: vi.fn()
  }
}));

vi.mock('../../models/user-profile', () => ({
  UserProfile: {
    findOne: vi.fn()
  }
}));

vi.mock('../../services/storage/s3', () => ({
  deleteFromS3: vi.fn()
}));

vi.mock('../../services/fs', () => ({
  safelyDelete: vi.fn()
}));

vi.mock('../../services/logging', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn()
  }
}));

describe('TranscriptionJobService', () => {
  let service: TranscriptionJobService;
  const userId = 'test-user-id';
  const jobId = 'job-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TranscriptionJobService();
  });

  describe('getJobs', () => {
    it('should throw NotFoundError if user profile not found', async () => {
      (UserProfile.findOne as Mock).mockResolvedValue(null);

      await expect(service.getJobs(userId)).rejects.toThrow(NotFoundError);
      expect(UserProfile.findOne).toHaveBeenCalledWith({ firebaseId: userId });
    });

    it('should return jobs for user', async () => {
      const mockJobs = [
        { id: '1', status: 'PENDING' as const },
        { id: '2', status: 'PROCESSING' as const }
      ];
      (UserProfile.findOne as Mock).mockResolvedValue({ id: 'profile-1' });
      (transcriptionJobRepository.findJobs as Mock).mockResolvedValue(mockJobs);

      const result = await service.getJobs(userId);

      expect(transcriptionJobRepository.findJobs).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockJobs);
    });
  });

  describe('updateJob', () => {
    const updateData: Partial<ITranscriptionJob> = { status: 'COMPLETED' as const };

    it('should throw NotFoundError if job not found', async () => {
      (transcriptionJobRepository.findById as Mock).mockResolvedValue(null);

      await expect(service.updateJob(jobId, userId, updateData)).rejects.toThrow(NotFoundError);

      expect(transcriptionJobRepository.findById).toHaveBeenCalledWith(jobId);
    });

    it('should throw UnauthorizedError if user does not own job', async () => {
      const mockJob = {
        _id: jobId,
        userId: 'different-user-id',
        status: 'QUEUED' as const
      };

      (transcriptionJobRepository.findById as Mock).mockResolvedValue(mockJob);

      await expect(service.updateJob(jobId, userId, updateData)).rejects.toThrow(UnauthorizedError);
    });

    it('should update job if authorized', async () => {
      const mockJob = {
        _id: jobId,
        userId,
        status: 'QUEUED' as const
      };

      (transcriptionJobRepository.findById as Mock).mockResolvedValue(mockJob);

      const result = await service.updateJob(jobId, userId, updateData);

      expect(transcriptionJobRepository.save).toHaveBeenCalledWith({
        _id: jobId,
        userId,
        status: 'COMPLETED'
      });

      expect(result).toEqual({
        _id: jobId,
        userId,
        status: 'COMPLETED'
      });
    });
  });

  describe('deleteJob', () => {
    it('should throw BadRequestError if no id provided', async () => {
      await expect(service.deleteJob('', userId)).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError if job not found', async () => {
      (transcriptionJobRepository.update as Mock).mockResolvedValue(null);

      await expect(service.deleteJob(jobId, userId)).rejects.toThrow(NotFoundError);
    });

    it('should mark job as deleted and clean up resources', async () => {
      const mockJob = {
        _id: jobId,
        userId,
        filename: 'test.mp4',
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        audioUrl: 'https://example.com/audio.mp3'
      };

      (transcriptionJobRepository.update as Mock).mockResolvedValue(mockJob);
      (deleteFromS3 as Mock).mockImplementation((name, callback) => callback());

      await service.deleteJob(jobId, userId);

      expect(transcriptionJobRepository.update).toHaveBeenCalledWith(jobId, {
        isDeleted: true
      });

      expect(safelyDelete).toHaveBeenCalledWith('/tmp/data/test.mp4');
      expect(safelyDelete).toHaveBeenCalledWith('/tmp/data/thumb.jpg');
      expect(safelyDelete).toHaveBeenCalledWith('/tmp/data/audio.mp3');

      expect(deleteFromS3).toHaveBeenCalledWith('video.mp4', expect.any(Function));
      expect(deleteFromS3).toHaveBeenCalledWith('thumb.jpg', expect.any(Function));
      expect(deleteFromS3).toHaveBeenCalledWith('audio.mp3', expect.any(Function));
    });

    it('should handle S3 deletion errors', async () => {
      const mockJob = {
        _id: jobId,
        userId,
        videoUrl: 'https://example.com/video.mp4'
      };

      const error = new Error('S3 Error');

      (transcriptionJobRepository.update as Mock).mockResolvedValue(mockJob);
      (deleteFromS3 as Mock).mockImplementation((name, callback) => callback(error));

      await service.deleteJob(jobId, userId);

      // Service should not throw error but log it instead
      expect(transcriptionJobRepository.update).toHaveBeenCalledWith(jobId, {
        isDeleted: true
      });
    });
  });
});
