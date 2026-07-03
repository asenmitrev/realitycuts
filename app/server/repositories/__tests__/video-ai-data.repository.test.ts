import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { VideoAIDataRepository } from '../video-ai-data.repository';
import { VideoAIData } from '../../models/video-ai-data';
import { TranscriptionJob } from '../../models/transcription-job';
import { ExportJob } from '../../models/export-job';
import { ITranscriptionJob, IVideoAIData } from '../../types';

// Mock the models
vi.mock('../../models/video-ai-data');
vi.mock('../../models/transcription-job');
vi.mock('../../models/export-job');

describe('VideoAIData Repository', () => {
  let videoAIDataRepository: VideoAIDataRepository;
  const userId = 'test-user-id';
  const videoId = 'test-video-id';
  const transcriptionJobId = 'test-job-id';

  beforeEach(() => {
    vi.clearAllMocks();
    videoAIDataRepository = new VideoAIDataRepository();
  });

  describe('findById', () => {
    it('should find a video by ID with populated transcription job', async () => {
      const mockTranscriptionJob: Partial<ITranscriptionJob> = {
        _id: transcriptionJobId,
        userId,
        status: 'COMPLETED',
        title: 'Test Video'
      };

      const mockVideo: Partial<IVideoAIData> = {
        _id: videoId,
        userId,
        title: 'Test Video',
        transcriptionJob: transcriptionJobId as any
      };

      const execMock = vi.fn().mockReturnValue({
        ...mockVideo,
        transcriptionJob: mockTranscriptionJob
      });

      const populateMock = vi.fn();

      (VideoAIData.findById as Mock).mockReturnValue({
        populate: populateMock,
        exec: execMock
      });

      const result = await videoAIDataRepository.findById(videoId, true);

      expect(VideoAIData.findById).toHaveBeenCalledWith(videoId);
      expect(populateMock).toHaveBeenCalledWith<[string]>('transcriptionJob');
      expect(result).toEqual({
        ...mockVideo,
        transcriptionJob: mockTranscriptionJob
      });
    });

    it('should find a video by ID without populating transcription job', async () => {
      const mockVideo: Partial<IVideoAIData> = {
        _id: videoId,
        userId,
        title: 'Test Video',
        transcriptionJob: transcriptionJobId as any
      };

      const execMock = vi.fn().mockResolvedValue(mockVideo);

      (VideoAIData.findById as Mock).mockReturnValue({
        populate: vi.fn(),
        exec: execMock
      });

      const result = await videoAIDataRepository.findById(videoId, false);

      expect(VideoAIData.findById).toHaveBeenCalledWith(videoId);
      expect(result).toEqual(mockVideo);
    });

    it('should return null if video not found', async () => {
      const execMock = vi.fn().mockResolvedValue(null);

      (VideoAIData.findById as Mock).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        exec: execMock
      });

      const result = await videoAIDataRepository.findById('non-existent-id');

      expect(VideoAIData.findById).toHaveBeenCalledWith('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findVideosWithPagination', () => {
    it('should find videos with pagination and filter out videos without source', async () => {
      const videos = [
        { _id: 'job-1', videoAIData: [{ _id: 'data-1', source: { metadata: {} }, transcriptionJob: 'job-1' }] },
        { _id: 'job-2', videoAIData: [{ _id: 'data-2', source: { metadata: {} }, transcriptionJob: 'job-2' }] }
      ];
      (TranscriptionJob.aggregate as Mock).mockResolvedValue([
        {
          total: [{ count: 5 }],
          videos
        }
      ]);

      const result = await videoAIDataRepository.findVideosWithPagination(userId, 0, 10);

      expect(TranscriptionJob.aggregate).toHaveBeenCalled();
      expect(result.total).toBe(5);
      expect(result.videos).toHaveLength(2);
      expect(result.videos[0].videoAIData).toHaveLength(1);
    });

    it('should use default pagination values if not provided', async () => {
      (TranscriptionJob.aggregate as Mock).mockResolvedValue([
        {
          total: [{ count: 1 }],
          videos: [{ _id: 'job-1', videoAIData: [{ _id: 'data-1', source: { metadata: {} }, transcriptionJob: 'job-1' }] }]
        }
      ]);

      const result = await videoAIDataRepository.findVideosWithPagination(userId);

      expect(TranscriptionJob.aggregate).toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.videos).toHaveLength(1);
    });

    it('should return empty array and zero count when no videos match', async () => {
      (TranscriptionJob.aggregate as Mock).mockResolvedValue([{ total: [], videos: [] }]);

      const result = await videoAIDataRepository.findVideosWithPagination(userId);

      expect(result).toEqual({ videos: [], total: 0 });
    });

    it('should exclude transcription jobs with incomplete VideoAIData (no source)', async () => {
      // The repository now uses a single aggregate pipeline; exclusion of incomplete VideoAIData is handled by lookup/projection.
      (TranscriptionJob.aggregate as Mock).mockResolvedValue([
        {
          total: [{ count: 1 }],
          videos: [{ _id: 'job-2', videoAIData: [] }]
        }
      ]);

      const result = await videoAIDataRepository.findVideosWithPagination(userId);

      expect(result.total).toBe(1);
    });
  });

  describe('getVideoCount', () => {
    it('should get count of videos for a user', async () => {
      (TranscriptionJob.countDocuments as Mock).mockResolvedValue(5);

      const result = await videoAIDataRepository.getVideoCount(userId);

      expect(TranscriptionJob.countDocuments).toHaveBeenCalledWith({
        userId,
        isDeleted: { $ne: true },
        status: { $in: ['VIDEO_RECEIVED', 'TRANSCRIBED', 'COMPLETED', 'FAILED'] }
      });
      expect(result).toBe(5);
    });
  });

  describe('update', () => {
    it('should update a video', async () => {
      const videoData: Partial<IVideoAIData> = {
        title: 'Updated Title'
      };

      const updatedVideo: Partial<IVideoAIData> = {
        _id: videoId,
        userId,
        title: 'Updated Title'
      };

      (VideoAIData.findByIdAndUpdate as Mock).mockResolvedValue(updatedVideo);

      const result = await videoAIDataRepository.update(videoId, videoData);

      expect(VideoAIData.findByIdAndUpdate).toHaveBeenCalledWith(videoId, { $set: videoData }, { new: true });
      expect(result).toEqual(updatedVideo);
    });

    it('should return null if video not found for update', async () => {
      const videoData: Partial<IVideoAIData> = {
        title: 'Updated Title'
      };

      (VideoAIData.findByIdAndUpdate as Mock).mockResolvedValue(null);

      const result = await videoAIDataRepository.update('non-existent-id', videoData);

      expect(VideoAIData.findByIdAndUpdate).toHaveBeenCalledWith('non-existent-id', { $set: videoData }, { new: true });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a video', async () => {
      const deletedVideo: Partial<IVideoAIData> = {
        _id: videoId,
        userId
      };

      (VideoAIData.findByIdAndDelete as Mock).mockResolvedValue(deletedVideo);

      const result = await videoAIDataRepository.delete(videoId);

      expect(VideoAIData.findByIdAndDelete).toHaveBeenCalledWith(videoId);
      expect(result).toEqual(deletedVideo);
    });

    it('should return null if video not found for deletion', async () => {
      (VideoAIData.findByIdAndDelete as Mock).mockResolvedValue(null);

      const result = await videoAIDataRepository.delete('non-existent-id');

      expect(VideoAIData.findByIdAndDelete).toHaveBeenCalledWith('non-existent-id');
      expect(result).toBeNull();
    });
  });
});
