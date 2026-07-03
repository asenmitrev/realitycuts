import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { BrollFootageMetadata } from '../../models/broll-video-metadata';
import { BrollRepository } from '../broll.repository';
import { IBrollFootageMetadata } from '../../types';
import { getObjectId } from '../../utils/mongoose-utils';

vi.mock('../../models/broll-video-metadata');
vi.mock('../../utils/mongoose-utils', () => ({
  getObjectId: vi.fn(id => id)
}));

describe('BrollRepository', () => {
  let repository: BrollRepository;
  const mockBrollId = 'broll-id-123';
  const mockLibraryId = 'library-id-123';
  const mockYoutubeUrl = 'https://www.youtube.com/watch?v=12345';

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new BrollRepository();
  });

  describe('findById', () => {
    it('should find broll footage by ID', async () => {
      const mockBroll = { _id: mockBrollId, title: 'Test Broll' };
      (BrollFootageMetadata.findById as Mock).mockResolvedValue(mockBroll);

      const result = await repository.findById(mockBrollId);

      expect(BrollFootageMetadata.findById).toHaveBeenCalledWith(mockBrollId);
      expect(result).toEqual(mockBroll);
    });

    it('should return null if broll footage not found', async () => {
      (BrollFootageMetadata.findById as Mock).mockResolvedValue(null);

      const result = await repository.findById(mockBrollId);

      expect(BrollFootageMetadata.findById).toHaveBeenCalledWith(mockBrollId);
      expect(result).toBeNull();
    });
  });

  describe('findByLibraryId', () => {
    it('should find broll footage by library ID with default pagination', async () => {
      const mockBrolls = [
        { _id: 'broll-1', libraryId: mockLibraryId },
        { _id: 'broll-2', libraryId: mockLibraryId }
      ];
      const mockTotal = 2;

      const mockSort = vi.fn().mockReturnThis();
      const mockSkip = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockBrolls);

      (BrollFootageMetadata.find as Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit
      });
      (BrollFootageMetadata.countDocuments as Mock).mockResolvedValue(mockTotal);

      const result = await repository.findByLibraryId(mockLibraryId);

      expect(BrollFootageMetadata.find).toHaveBeenCalledWith({
        libraryId: mockLibraryId,
        isDeleted: { $ne: true }
      });
      expect(mockSort).toHaveBeenCalledWith({ updatedAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(BrollFootageMetadata.countDocuments).toHaveBeenCalledWith({
        libraryId: mockLibraryId,
        isDeleted: { $ne: true }
      });
      expect(result).toEqual({ broll: mockBrolls, total: mockTotal });
    });

    it('should find broll footage by library ID with custom pagination', async () => {
      const mockBrolls = [{ _id: 'broll-3', libraryId: mockLibraryId }];
      const mockTotal = 3;

      const mockSort = vi.fn().mockReturnThis();
      const mockSkip = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockBrolls);

      (BrollFootageMetadata.find as Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit
      });
      (BrollFootageMetadata.countDocuments as Mock).mockResolvedValue(mockTotal);

      const result = await repository.findByLibraryId(mockLibraryId, 20, 5);

      expect(BrollFootageMetadata.find).toHaveBeenCalledWith({
        libraryId: mockLibraryId,
        isDeleted: { $ne: true }
      });
      expect(mockSort).toHaveBeenCalledWith({ updatedAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(20);
      expect(mockLimit).toHaveBeenCalledWith(5);
      expect(BrollFootageMetadata.countDocuments).toHaveBeenCalledWith({
        libraryId: mockLibraryId,
        isDeleted: { $ne: true }
      });
      expect(result).toEqual({ broll: mockBrolls, total: mockTotal });
    });
  });

  describe('countByLibraryId', () => {
    it('should count broll footage by library ID', async () => {
      const mockCount = 5;
      (BrollFootageMetadata.countDocuments as Mock).mockResolvedValue(mockCount);

      const result = await repository.countByLibraryId(mockLibraryId);

      expect(BrollFootageMetadata.countDocuments).toHaveBeenCalledWith({
        libraryId: mockLibraryId,
        isDeleted: { $ne: true }
      });
      expect(result).toBe(mockCount);
    });
  });

  describe('update', () => {
    it('should update broll footage by ID', async () => {
      const updateData: Partial<IBrollFootageMetadata> = { title: 'Updated Broll' };
      const updatedBroll = { _id: mockBrollId, ...updateData };

      (BrollFootageMetadata.findByIdAndUpdate as Mock).mockResolvedValue(updatedBroll);

      const result = await repository.update(mockBrollId, updateData);

      expect(BrollFootageMetadata.findByIdAndUpdate).toHaveBeenCalledWith(mockBrollId, updateData, { new: true });
      expect(result).toEqual(updatedBroll);
    });
  });

  describe('updateByLibraryId', () => {
    it('should update broll footage by library ID', async () => {
      const updateData: Partial<IBrollFootageMetadata> = { isPublic: true };

      (BrollFootageMetadata.updateMany as Mock).mockResolvedValue({ acknowledged: true, modifiedCount: 3 });

      await repository.updateByLibraryId(mockLibraryId, updateData);

      expect(BrollFootageMetadata.updateMany).toHaveBeenCalledWith({ libraryId: mockLibraryId }, updateData);
    });
  });

  describe('markAsDeleted', () => {
    it('should mark broll as deleted', async () => {
      const deletedBroll = { _id: mockBrollId, isDeleted: true };

      (BrollFootageMetadata.findByIdAndUpdate as Mock).mockResolvedValue(deletedBroll);

      const result = await repository.markAsDeleted(mockBrollId);

      expect(BrollFootageMetadata.findByIdAndUpdate).toHaveBeenCalledWith(
        mockBrollId,
        { isDeleted: true },
        { new: true }
      );
      expect(result).toEqual(deletedBroll);
    });
  });

  describe('findByYoutubeUrl', () => {
    it('should find broll footage by original YouTube URL', async () => {
      const mockBrolls = [
        { _id: 'broll-1', libraryId: mockLibraryId, originalYoutubeUrl: mockYoutubeUrl },
        { _id: 'broll-2', libraryId: mockLibraryId, originalYoutubeUrl: mockYoutubeUrl }
      ];

      (BrollFootageMetadata.find as Mock).mockResolvedValue(mockBrolls);

      const result = await repository.findByYoutubeUrl(mockLibraryId, mockYoutubeUrl);

      expect(BrollFootageMetadata.find).toHaveBeenCalledWith({
        libraryId: mockLibraryId,
        originalYoutubeUrl: mockYoutubeUrl,
        isDeleted: { $ne: true }
      });
      expect(result).toEqual(mockBrolls);
    });
  });
});
