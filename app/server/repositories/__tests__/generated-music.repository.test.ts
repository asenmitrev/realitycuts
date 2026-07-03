import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GeneratedMusic } from '../../models/generated-music';
import { GeneratedMusicRepository } from '../generated-music.repository';
import { IGeneratedMusic } from '../../types';

vi.mock('../../models/generated-music');

describe('GeneratedMusicRepository', () => {
  let repository: GeneratedMusicRepository;
  const mockUserId = 'user-123';
  const mockMusicId = 'music-123';

  const mockMusic: Partial<IGeneratedMusic> = {
    _id: mockMusicId,
    userId: mockUserId,
    prompt: 'Upbeat electronic music',
    duration: 30,
    estimatedMood: 'energetic',
    videoType: 'short',
    usageCount: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new GeneratedMusicRepository();
  });

  describe('create', () => {
    it('should create a new generated music record', async () => {
      const mockSave = vi.fn().mockResolvedValue(mockMusic);
      const mockConstructor = vi.fn().mockImplementation(() => ({
        save: mockSave
      }));
      (GeneratedMusic as any).mockImplementation(mockConstructor);

      const result = await repository.create(mockMusic);

      expect(mockConstructor).toHaveBeenCalledWith(mockMusic);
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockMusic);
    });
  });

  describe('findById', () => {
    it('should find music by ID', async () => {
      (GeneratedMusic.findById as Mock).mockResolvedValue(mockMusic);

      const result = await repository.findById(mockMusicId);

      expect(GeneratedMusic.findById).toHaveBeenCalledWith(mockMusicId);
      expect(result).toEqual(mockMusic);
    });

    it('should return null when music not found', async () => {
      (GeneratedMusic.findById as Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find music by user ID with pagination', async () => {
      const mockMusics = [mockMusic];
      const mockSkip = vi.fn().mockResolvedValue(mockMusics);
      const mockLimit = vi.fn().mockReturnValue({ skip: mockSkip });
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (GeneratedMusic.find as Mock).mockReturnValue({
        sort: mockSort
      });

      const result = await repository.findByUserId(mockUserId, 20, 0);

      expect(GeneratedMusic.find).toHaveBeenCalledWith({ userId: mockUserId });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(result).toEqual(mockMusics);
    });
  });

  describe('findSimilarMusic', () => {
    it('should find exact match by prompt', async () => {
      const mockMusics = [mockMusic];
      const mockLimit = vi.fn().mockResolvedValue(mockMusics);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (GeneratedMusic.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      const result = await repository.findSimilarMusic(mockUserId, 'Upbeat electronic music', 5);

      expect(GeneratedMusic.find).toHaveBeenCalledWith({
        userId: mockUserId,
        prompt: 'Upbeat electronic music'
      });
      expect(result).toEqual(mockMusics);
    });

    it('should find similar music by text search when no exact match', async () => {
      const mockMusics = [mockMusic];
      const mockLimitSecond = vi.fn().mockResolvedValue(mockMusics);
      const mockSortSecond = vi.fn().mockReturnValue({ limit: mockLimitSecond });
      const mockLimitFirst = vi.fn().mockResolvedValue([]);
      const mockSortFirst = vi.fn().mockReturnValue({ limit: mockLimitFirst });
      (GeneratedMusic.find as Mock)
        .mockReturnValueOnce({
          sort: mockSortFirst
        })
        .mockReturnValue({
          sort: mockSortSecond
        });

      const result = await repository.findSimilarMusic(mockUserId, 'electronic', 5);

      expect(GeneratedMusic.find).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockMusics);
    });
  });

  describe('findByCharacteristics', () => {
    it('should find music by mood', async () => {
      const mockMusics = [mockMusic];
      const mockLimit = vi.fn().mockResolvedValue(mockMusics);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (GeneratedMusic.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      const result = await repository.findByCharacteristics(mockUserId, { estimatedMood: 'energetic' }, 10);

      expect(GeneratedMusic.find).toHaveBeenCalledWith({
        userId: mockUserId,
        estimatedMood: 'energetic'
      });
      expect(result).toEqual(mockMusics);
    });

    it('should find music by videoType', async () => {
      const mockMusics = [mockMusic];
      const mockLimit = vi.fn().mockResolvedValue(mockMusics);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (GeneratedMusic.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      const result = await repository.findByCharacteristics(mockUserId, { videoType: 'short' }, 10);

      expect(GeneratedMusic.find).toHaveBeenCalledWith({
        userId: mockUserId,
        videoType: 'short'
      });
      expect(result).toEqual(mockMusics);
    });

    it('should find music by duration range', async () => {
      const mockMusics = [mockMusic];
      const mockLimit = vi.fn().mockResolvedValue(mockMusics);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (GeneratedMusic.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      const result = await repository.findByCharacteristics(mockUserId, { duration: 30 }, 10);

      expect(GeneratedMusic.find).toHaveBeenCalledWith({
        userId: mockUserId,
        duration: { $gte: 27, $lte: 33 }
      });
      expect(result).toEqual(mockMusics);
    });

    it('should find music by multiple characteristics', async () => {
      const mockMusics = [mockMusic];
      const mockLimit = vi.fn().mockResolvedValue(mockMusics);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (GeneratedMusic.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      const result = await repository.findByCharacteristics(
        mockUserId,
        {
          estimatedMood: 'energetic',
          videoType: 'short',
          duration: 30
        },
        10
      );

      expect(GeneratedMusic.find).toHaveBeenCalledWith({
        userId: mockUserId,
        estimatedMood: 'energetic',
        videoType: 'short',
        duration: { $gte: 27, $lte: 33 }
      });
      expect(result).toEqual(mockMusics);
    });
  });

  describe('incrementUsageCount', () => {
    it('should increment usage count', async () => {
      const updatedMusic = { ...mockMusic, usageCount: 1 };
      (GeneratedMusic.findByIdAndUpdate as Mock).mockResolvedValue(updatedMusic);

      const result = await repository.incrementUsageCount(mockMusicId);

      expect(GeneratedMusic.findByIdAndUpdate).toHaveBeenCalledWith(
        mockMusicId,
        { $inc: { usageCount: 1 } },
        { new: true }
      );
      expect(result).toEqual(updatedMusic);
    });
  });

  describe('getMostUsedByUser', () => {
    it('should get most used music by user', async () => {
      const mockMusics = [mockMusic];
      const mockLimit = vi.fn().mockResolvedValue(mockMusics);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (GeneratedMusic.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      const result = await repository.getMostUsedByUser(mockUserId, 10);

      expect(GeneratedMusic.find).toHaveBeenCalledWith({ userId: mockUserId });
      expect(mockSort).toHaveBeenCalledWith({ usageCount: -1, createdAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockMusics);
    });
  });

  describe('deleteById', () => {
    it('should delete music by ID', async () => {
      (GeneratedMusic.findByIdAndDelete as Mock).mockResolvedValue(mockMusic);

      await repository.deleteById(mockMusicId);

      expect(GeneratedMusic.findByIdAndDelete).toHaveBeenCalledWith(mockMusicId);
    });
  });

  describe('deleteByUserId', () => {
    it('should delete all music for a user', async () => {
      (GeneratedMusic.deleteMany as Mock).mockResolvedValue({ deletedCount: 5 });

      await repository.deleteByUserId(mockUserId);

      expect(GeneratedMusic.deleteMany).toHaveBeenCalledWith({ userId: mockUserId });
    });
  });

  describe('countByUserId', () => {
    it('should count total music generated by user', async () => {
      (GeneratedMusic.countDocuments as Mock).mockResolvedValue(15);

      const result = await repository.countByUserId(mockUserId);

      expect(GeneratedMusic.countDocuments).toHaveBeenCalledWith({ userId: mockUserId });
      expect(result).toBe(15);
    });
  });

  describe('getUserMusicStats', () => {
    it('should get user music statistics', async () => {
      const mockStats = [
        {
          _id: null,
          totalGenerated: 10,
          totalUsage: 25,
          moods: ['energetic', 'calm', 'energetic'],
          videoTypes: ['short', 'short', 'long']
        }
      ];
      (GeneratedMusic.aggregate as Mock).mockResolvedValue(mockStats);

      const result = await repository.getUserMusicStats(mockUserId);

      expect(GeneratedMusic.aggregate).toHaveBeenCalled();
      expect(result).toEqual({
        totalGenerated: 10,
        totalUsage: 25,
        mostUsedMood: 'energetic',
        mostUsedVideoType: 'short'
      });
    });

    it('should return zero stats when no music found', async () => {
      (GeneratedMusic.aggregate as Mock).mockResolvedValue([]);

      const result = await repository.getUserMusicStats(mockUserId);

      expect(result).toEqual({
        totalGenerated: 0,
        totalUsage: 0
      });
    });
  });
});
