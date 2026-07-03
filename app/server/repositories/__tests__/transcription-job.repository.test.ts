import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { TranscriptionJobRepository } from '../transcription-job.repository';
import { TranscriptionJob } from '../../models/transcription-job';
import { ITranscriptionJob } from '../../types';

// Mock the model
vi.mock('../../models/transcription-job');

describe('TranscriptionJob Repository', () => {
  let transcriptionJobRepository: TranscriptionJobRepository;
  const userId = 'test-user-id';
  const jobId = 'test-job-id';

  beforeEach(() => {
    vi.clearAllMocks();
    transcriptionJobRepository = new TranscriptionJobRepository();
  });

  describe('findById', () => {
    it('should find a transcription job by ID', async () => {
      const mockJob: Partial<ITranscriptionJob> = {
        _id: jobId,
        userId,
        videoUrl: 'https://example.com/video.mp4',
        status: 'CREATED'
      };

      (TranscriptionJob.findById as Mock).mockResolvedValue(mockJob);

      const result = await transcriptionJobRepository.findById(jobId);

      expect(TranscriptionJob.findById).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(mockJob);
    });

    it('should return null if job not found', async () => {
      (TranscriptionJob.findById as Mock).mockResolvedValue(null);

      const result = await transcriptionJobRepository.findById('non-existent-id');

      expect(TranscriptionJob.findById).toHaveBeenCalledWith('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findJobs', () => {
    it('should find jobs by user ID with filter conditions', async () => {
      const mockJobs: Partial<ITranscriptionJob>[] = [
        {
          _id: 'job-1',
          userId,
          status: 'CREATED',
          isDeleted: false
        },
        {
          _id: 'job-2',
          userId,
          status: 'QUEUED',
          isDeleted: false
        }
      ];

      const findMock = vi.fn().mockReturnThis();
      const sortMock = vi.fn().mockResolvedValue(mockJobs);

      (TranscriptionJob.find as Mock).mockReturnValue({
        sort: sortMock
      });

      const result = await transcriptionJobRepository.findJobs(userId);

      expect(TranscriptionJob.find).toHaveBeenCalledWith({
        userId,
        status: { $ne: 'COMPLETED' },
        isDeleted: { $ne: true }
      });
      expect(sortMock).toHaveBeenCalledWith({ updatedAt: -1 });
      expect(result).toEqual(mockJobs);
    });
  });

  describe('update', () => {
    it('should update a transcription job', async () => {
      const jobData: Partial<ITranscriptionJob> = {
        status: 'TRANSCRIBED'
      };

      const updatedJob: Partial<ITranscriptionJob> = {
        _id: jobId,
        userId,
        status: 'TRANSCRIBED'
      };

      (TranscriptionJob.findByIdAndUpdate as Mock).mockResolvedValue(updatedJob);

      const result = await transcriptionJobRepository.update(jobId, jobData);

      expect(TranscriptionJob.findByIdAndUpdate).toHaveBeenCalledWith(jobId, { $set: jobData }, { new: true });
      expect(result).toEqual(updatedJob);
    });

    it('should return null if job not found for update', async () => {
      const jobData: Partial<ITranscriptionJob> = {
        status: 'TRANSCRIBED'
      };

      (TranscriptionJob.findByIdAndUpdate as Mock).mockResolvedValue(null);

      const result = await transcriptionJobRepository.update('non-existent-id', jobData);

      expect(TranscriptionJob.findByIdAndUpdate).toHaveBeenCalledWith(
        'non-existent-id',
        { $set: jobData },
        { new: true }
      );
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should save a transcription job', async () => {
      const jobData: Partial<ITranscriptionJob> = {
        _id: jobId,
        userId,
        status: 'COMPLETED'
      };

      (TranscriptionJob.updateOne as Mock).mockResolvedValue({ acknowledged: true });

      await transcriptionJobRepository.save(jobData as ITranscriptionJob);

      expect(TranscriptionJob.updateOne).toHaveBeenCalledWith({ _id: jobId }, jobData, { upsert: true });
    });
  });

  describe('delete', () => {
    it('should delete a transcription job', async () => {
      (TranscriptionJob.findByIdAndDelete as Mock).mockResolvedValue({ _id: jobId });

      await transcriptionJobRepository.delete(jobId);

      expect(TranscriptionJob.findByIdAndDelete).toHaveBeenCalledWith(jobId);
    });
  });

  describe('create', () => {
    it('should create a new transcription job', async () => {
      const jobData: Partial<ITranscriptionJob> = {
        userId,
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumbnail.jpg',
        audioUrl: 'https://example.com/audio.mp3',
        title: 'Test Video',
        batchName: 'batch-1',
        filename: 'video.mp4',
        guidance: 'Test guidance',
        includeMusic: true,
        isDeleted: false,
        pinecone: true,
        jobType: 'B_ROLL',
        status: 'CREATED'
      };

      const createdJob: Partial<ITranscriptionJob> = {
        ...jobData,
        _id: jobId
      };

      (TranscriptionJob.create as Mock).mockResolvedValue(createdJob);

      const result = await transcriptionJobRepository.create(jobData);

      expect(TranscriptionJob.create).toHaveBeenCalledWith(jobData);
      expect(result).toEqual(createdJob);
    });
  });
});
