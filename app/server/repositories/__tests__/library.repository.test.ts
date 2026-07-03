import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Library } from '../../models/library';
import { LibraryUpload } from '../../models/library-upload';
import { BrollFootageMetadata } from '../../models/broll-video-metadata';
import { LibraryRepository } from '../library.repository';
import { ILibrary, ILibraryUpload, IBrollFootageMetadata } from '../../types';
import { Types } from 'mongoose';

vi.mock('../../models/library');
vi.mock('../../models/library-upload');
vi.mock('../../models/broll-video-metadata');
vi.mock('mongoose', async () => {
  const actual = await vi.importActual('mongoose');
  return {
    default: actual,
    Types: {
      ObjectId: vi.fn().mockImplementation(v => v)
    }
  };
});

describe('LibraryRepository', () => {
  let repository: LibraryRepository;
  const mockLibraryId = 'library-123';
  const mockUserId = 'user-123';
  const mockUploadId = 'upload-123';

  const mockLibrary: Partial<ILibrary> = {
    _id: mockLibraryId,
    userId: mockUserId,
    title: 'Test Library',
    status: 'PROCESSED',
    isPublic: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new LibraryRepository();
  });

  describe('findById', () => {
    it('should find library by ID without populating', async () => {
      (Library.findById as Mock).mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockLibrary)
      });

      const result = await repository.findById(mockLibraryId, false);

      expect(Library.findById).toHaveBeenCalledWith(mockLibraryId);
      expect(result).toEqual(mockLibrary);
    });

    it('should find library by ID with populating', async () => {
      const populatedLibrary = { ...mockLibrary, processedFiles: [] };
      const mockPopulate = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(populatedLibrary)
      });
      (Library.findById as Mock).mockReturnValue({
        populate: mockPopulate,
        exec: vi.fn().mockResolvedValue(populatedLibrary)
      });

      const result = await repository.findById(mockLibraryId, true);

      expect(Library.findById).toHaveBeenCalledWith(mockLibraryId);
      expect(result).toEqual(populatedLibrary);
    });
  });

  describe('findByIdAndUserId', () => {
    it('should find library by ID and user ID', async () => {
      const mockFindOne = {
        populate: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockLibrary)
        }),
        exec: vi.fn().mockResolvedValue(mockLibrary)
      };
      (Library.findOne as Mock).mockReturnValue(mockFindOne);

      const result = await repository.findByIdAndUserId(mockLibraryId, mockUserId, false);

      expect(Library.findOne).toHaveBeenCalledWith({ _id: mockLibraryId, userId: mockUserId });
      expect(result).toEqual(mockLibrary);
    });
  });

  describe('findAllByUserId', () => {
    it('should find all libraries by user ID excluding NEW and DELETED', async () => {
      const mockLibraries = [mockLibrary];
      (Library.find as Mock).mockReturnValue({
        select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockLibraries)
        })
      });

      const result = await repository.findAllByUserId(mockUserId);

      expect(Library.find).toHaveBeenCalledWith({
        userId: mockUserId,
        status: { $nin: ['NEW', 'DELETED'] }
      });
      expect(result).toEqual(mockLibraries);
    });
  });

  describe('findNewByUserId', () => {
    it('should find NEW library by user ID', async () => {
      const newLibrary = { ...mockLibrary, status: 'NEW' };
      (Library.findOne as Mock).mockReturnValue({
        populate: vi.fn().mockResolvedValue(newLibrary)
      });

      const result = await repository.findNewByUserId(mockUserId);

      expect(Library.findOne).toHaveBeenCalledWith({ userId: mockUserId, status: 'NEW' });
      expect(result).toEqual(newLibrary);
    });
  });

  describe('getNonNewLibraryCount', () => {
    it('should get count of non-NEW libraries for user', async () => {
      (Library.countDocuments as Mock).mockResolvedValue(5);

      const result = await repository.getNonNewLibraryCount(mockUserId);

      expect(Library.countDocuments).toHaveBeenCalledWith({
        userId: mockUserId,
        status: { $ne: 'NEW' }
      });
      expect(result).toBe(5);
    });
  });

  describe('findPublicLibraries', () => {
    it('should find public libraries without search', async () => {
      const mockLibraries = [{ ...mockLibrary, isPublic: true }];
      (Library.find as Mock).mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockLibraries)
        })
      });

      const result = await repository.findPublicLibraries(mockUserId, 0, 100);

      expect(Library.find).toHaveBeenCalledWith({
        userId: { $ne: mockUserId },
        isPublic: true,
        status: { $nin: ['NEW', 'DELETED'] }
      });
    });

    it('should find public libraries with search', async () => {
      const mockLibraries = [{ ...mockLibrary, isPublic: true }];
      (Library.find as Mock).mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockLibraries)
        })
      });

      const result = await repository.findPublicLibraries(mockUserId, 0, 100, 'test');

      expect(Library.find).toHaveBeenCalled();
    });
  });

  describe('countPublicLibraries', () => {
    it('should count public libraries without search', async () => {
      (Library.countDocuments as Mock).mockResolvedValue(10);

      const result = await repository.countPublicLibraries(mockUserId);

      expect(Library.countDocuments).toHaveBeenCalledWith({
        userId: { $ne: mockUserId },
        isPublic: true,
        status: { $nin: ['NEW', 'DELETED'] }
      });
      expect(result).toBe(10);
    });

    it('should count public libraries with search', async () => {
      (Library.countDocuments as Mock).mockResolvedValue(5);

      const result = await repository.countPublicLibraries(mockUserId, 'test');

      expect(Library.countDocuments).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });

  describe('findPublicLibrariesByIds', () => {
    it('should find public libraries by IDs', async () => {
      const mockLibraries = [{ ...mockLibrary, isPublic: true }];
      (Library.find as Mock).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockLibraries)
      });

      const result = await repository.findPublicLibrariesByIds([mockLibraryId]);

      expect(Library.find).toHaveBeenCalledWith({
        _id: { $in: [mockLibraryId] },
        isPublic: true,
        status: { $ne: 'NEW' }
      });
      expect(result).toEqual(mockLibraries);
    });
  });

  describe('create', () => {
    it('should create a new library', async () => {
      const mockSave = vi.fn().mockResolvedValue(mockLibrary);
      const mockConstructor = vi.fn().mockImplementation(() => ({
        save: mockSave
      }));
      (Library as any).mockImplementation(mockConstructor);

      const result = await repository.create(mockLibrary);

      expect(mockConstructor).toHaveBeenCalledWith(mockLibrary);
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockLibrary);
    });
  });

  describe('update', () => {
    it('should update a library', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedLibrary = { ...mockLibrary, ...updateData };
      (Library.findByIdAndUpdate as Mock).mockResolvedValue(updatedLibrary);

      const result = await repository.update(mockLibraryId, updateData);

      expect(Library.findByIdAndUpdate).toHaveBeenCalledWith(mockLibraryId, updateData, {
        new: true
      });
      expect(result).toEqual(updatedLibrary);
    });
  });

  describe('addProcessedFilesToLibrary', () => {
    it('should add processed files to library', async () => {
      const updatedLibrary = { ...mockLibrary, processedFiles: [] };
      (Library.findByIdAndUpdate as Mock).mockResolvedValue(updatedLibrary);

      const result = await repository.addProcessedFilesToLibrary(mockLibraryId, mockUploadId);

      expect(Library.findByIdAndUpdate).toHaveBeenCalledWith(
        mockLibraryId,
        { $push: { processedFiles: { link: mockUploadId, prompt: '', status: 'NEW' } } },
        { new: true }
      );
      expect(result).toEqual(updatedLibrary);
    });
  });

  describe('markAsDeleted', () => {
    it('should mark library as deleted', async () => {
      const deletedLibrary = { ...mockLibrary, status: 'DELETED' };
      (Library.findByIdAndUpdate as Mock).mockResolvedValue(deletedLibrary);

      const result = await repository.markAsDeleted(mockLibraryId);

      expect(Library.findByIdAndUpdate).toHaveBeenCalledWith(mockLibraryId, { status: 'DELETED' }, { new: true });
      expect(result).toEqual(deletedLibrary);
    });
  });

  // LibraryUpload operations
  describe('findUploadById', () => {
    it('should find library upload by ID', async () => {
      const mockUpload: Partial<ILibraryUpload> = { _id: mockUploadId };
      (LibraryUpload.findById as Mock).mockResolvedValue(mockUpload);

      const result = await repository.findUploadById(mockUploadId);

      expect(LibraryUpload.findById).toHaveBeenCalledWith(mockUploadId);
      expect(result).toEqual(mockUpload);
    });
  });

  describe('findUploadsByLibraryId', () => {
    it('should find library uploads by library ID', async () => {
      const mockUploads: Partial<ILibraryUpload>[] = [{ _id: mockUploadId }];
      (LibraryUpload.find as Mock).mockResolvedValue(mockUploads);

      const result = await repository.findUploadsByLibraryId(mockLibraryId);

      expect(LibraryUpload.find).toHaveBeenCalledWith({ libraryId: mockLibraryId });
      expect(result).toEqual(mockUploads);
    });
  });

  describe('createUpload', () => {
    it('should create a new library upload', async () => {
      const mockUpload: Partial<ILibraryUpload> = { _id: mockUploadId };
      const mockSave = vi.fn().mockResolvedValue(mockUpload);
      const mockConstructor = vi.fn().mockImplementation(() => ({
        save: mockSave
      }));
      (LibraryUpload as any).mockImplementation(mockConstructor);

      const result = await repository.createUpload(mockUpload);

      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockUpload);
    });
  });

  describe('updateUpload', () => {
    it('should update a library upload', async () => {
      const updateData: Partial<ILibraryUpload> = { uploadStatus: 'COMPLETED' };
      const updatedUpload = { _id: mockUploadId, ...updateData } as ILibraryUpload;
      (LibraryUpload.findByIdAndUpdate as Mock).mockResolvedValue(updatedUpload);

      const result = await repository.updateUpload(mockUploadId, updateData);

      expect(LibraryUpload.findByIdAndUpdate).toHaveBeenCalledWith(mockUploadId, updateData, { new: true });
      expect(result).toEqual(updatedUpload);
    });
  });

  describe('deleteUpload', () => {
    it('should delete a library upload', async () => {
      (LibraryUpload.findByIdAndDelete as Mock).mockResolvedValue({ _id: mockUploadId });

      const result = await repository.deleteUpload(mockUploadId);

      expect(LibraryUpload.findByIdAndDelete).toHaveBeenCalledWith(mockUploadId);
      expect(result).toBe(true);
    });

    it('should return false when upload not found', async () => {
      (LibraryUpload.findByIdAndDelete as Mock).mockResolvedValue(null);

      const result = await repository.deleteUpload('non-existent-id');

      expect(result).toBe(false);
    });
  });

  // BrollFootageMetadata operations
  describe('findBrollById', () => {
    it('should find broll footage by ID', async () => {
      const mockBroll: Partial<IBrollFootageMetadata> = { _id: 'broll-123' };
      (BrollFootageMetadata.findById as Mock).mockResolvedValue(mockBroll);

      const result = await repository.findBrollById('broll-123');

      expect(BrollFootageMetadata.findById).toHaveBeenCalledWith('broll-123');
      expect(result).toEqual(mockBroll);
    });
  });

  describe('findBrollByLibraryId', () => {
    it('should find broll footage by library ID with pagination', async () => {
      const mockBrolls: Partial<IBrollFootageMetadata>[] = [{ _id: 'broll-123' }];
      const mockLimit = vi.fn().mockResolvedValue(mockBrolls);
      const mockSkip = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = vi.fn().mockReturnValue({ skip: mockSkip });
      (BrollFootageMetadata.find as Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit
      });

      const result = await repository.findBrollByLibraryId(mockLibraryId, 0, 10);

      expect(BrollFootageMetadata.find).toHaveBeenCalledWith({
        libraryId: mockLibraryId,
        isDeleted: { $ne: true }
      });
      expect(mockSort).toHaveBeenCalledWith({ updatedAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockBrolls);
    });
  });

  describe('countBrollByLibraryId', () => {
    it('should count broll footage by library ID', async () => {
      (BrollFootageMetadata.countDocuments as Mock).mockResolvedValue(20);

      const result = await repository.countBrollByLibraryId(mockLibraryId);

      expect(BrollFootageMetadata.countDocuments).toHaveBeenCalledWith({
        libraryId: mockLibraryId,
        isDeleted: { $ne: true }
      });
      expect(result).toBe(20);
    });
  });

  describe('findLibrariesEligibleForClustering', () => {
    it('should find libraries eligible for clustering', async () => {
      const mockLibraries = [mockLibrary];
      (Library.aggregate as Mock).mockResolvedValue(mockLibraries);

      const result = await repository.findLibrariesEligibleForClustering(100);

      expect(Library.aggregate).toHaveBeenCalled();
      expect(result).toEqual(mockLibraries);
    });
  });

  describe('updateBroll', () => {
    it('should update broll footage by ID', async () => {
      const updateData = { title: 'Updated Broll' };
      const updatedBroll = { _id: 'broll-123', ...updateData };
      (BrollFootageMetadata.findByIdAndUpdate as Mock).mockResolvedValue(updatedBroll);

      const result = await repository.updateBroll('broll-123', updateData);

      expect(BrollFootageMetadata.findByIdAndUpdate).toHaveBeenCalledWith('broll-123', updateData, { new: true });
      expect(result).toEqual(updatedBroll);
    });
  });

  describe('markBrollAsDeleted', () => {
    it('should mark broll as deleted', async () => {
      const deletedBroll = { _id: 'broll-123', isDeleted: true };
      (BrollFootageMetadata.findByIdAndUpdate as Mock).mockResolvedValue(deletedBroll);

      const result = await repository.markBrollAsDeleted('broll-123');

      expect(BrollFootageMetadata.findByIdAndUpdate).toHaveBeenCalledWith(
        'broll-123',
        { isDeleted: true },
        { new: true }
      );
      expect(result).toEqual(deletedBroll);
    });
  });

  describe('markMultipleBrollAsDeleted', () => {
    it('should mark multiple broll items as deleted', async () => {
      (BrollFootageMetadata.updateMany as Mock).mockResolvedValue({ modifiedCount: 3 });

      await repository.markMultipleBrollAsDeleted(['broll-1', 'broll-2', 'broll-3']);

      expect(BrollFootageMetadata.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ['broll-1', 'broll-2', 'broll-3'] } },
        { $set: { isDeleted: true } }
      );
    });
  });

  describe('findBrollByIds', () => {
    it('should find multiple broll items by their IDs', async () => {
      const mockBrolls: Partial<IBrollFootageMetadata>[] = [{ _id: 'broll-1' }];
      (BrollFootageMetadata.find as Mock).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockBrolls)
      });

      const result = await repository.findBrollByIds(['broll-1']);

      expect(BrollFootageMetadata.find).toHaveBeenCalledWith({
        _id: { $in: ['broll-1'] }
      });
      expect(result).toEqual(mockBrolls);
    });
  });

  describe('updateBrollIsPublicByLibraryId', () => {
    it('should update all broll isPublic status by library ID', async () => {
      (BrollFootageMetadata.updateMany as Mock).mockResolvedValue({ modifiedCount: 5 });

      await repository.updateBrollIsPublicByLibraryId(mockLibraryId, true);

      expect(BrollFootageMetadata.updateMany).toHaveBeenCalledWith(
        { libraryId: mockLibraryId },
        { $set: { isPublic: true } }
      );
    });
  });

  describe('getBrollScreenshotsByLibraryId', () => {
    it('should get screenshots from broll by library ID', async () => {
      const mockBrolls = [{ thumbnailUrl: 'url1' }, { thumbnailUrl: 'url2' }];
      (BrollFootageMetadata.find as Mock).mockReturnValue({
        limit: vi.fn().mockResolvedValue(mockBrolls)
      });

      const result = await repository.getBrollScreenshotsByLibraryId(mockLibraryId, 10);

      expect(BrollFootageMetadata.find).toHaveBeenCalledWith(
        {
          libraryId: mockLibraryId,
          isDeleted: { $ne: true },
          thumbnailUrl: { $exists: true, $ne: null }
        },
        { thumbnailUrl: 1 }
      );
      expect(result).toEqual(['url1', 'url2']);
    });
  });

  describe('findBrollByMetadataFilters', () => {
    it('should find broll by metadata filters', async () => {
      const mockBrolls: Partial<IBrollFootageMetadata>[] = [{ _id: 'broll-123' }];
      const mockLimit = vi.fn().mockResolvedValue(mockBrolls);
      const mockSkip = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = vi.fn().mockReturnValue({ skip: mockSkip });
      (BrollFootageMetadata.find as Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit
      });

      const result = await repository.findBrollByMetadataFilters([mockLibraryId], { framing: 'close-up' }, 0, 20);

      expect(BrollFootageMetadata.find).toHaveBeenCalled();
      expect(result).toEqual(mockBrolls);
    });
  });

  describe('countBrollByMetadataFilters', () => {
    it('should count broll by metadata filters', async () => {
      (BrollFootageMetadata.countDocuments as Mock).mockResolvedValue(15);

      const result = await repository.countBrollByMetadataFilters(
        [mockLibraryId],
        undefined,
        { framing: 'close-up' },
        false
      );

      expect(BrollFootageMetadata.countDocuments).toHaveBeenCalled();
      expect(result).toBe(15);
    });
  });

  describe('getLibraryStatsByUser', () => {
    it('should get library statistics by user', async () => {
      const mockStats = [{ _id: 'user-1', count: 5 }];
      (Library.aggregate as Mock).mockResolvedValue(mockStats);

      const result = await repository.getLibraryStatsByUser(25, []);

      expect(Library.aggregate).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('findAllLibrariesWithPagination', () => {
    it('should find all libraries with pagination', async () => {
      const mockLibraries = [mockLibrary];
      (Library.countDocuments as Mock).mockResolvedValue(100);
      (Library.aggregate as Mock).mockResolvedValue(mockLibraries);

      const result = await repository.findAllLibrariesWithPagination(0, 50, []);

      expect(Library.countDocuments).toHaveBeenCalled();
      expect(Library.aggregate).toHaveBeenCalled();
      expect(result).toEqual({ libraries: mockLibraries, total: 100 });
    });
  });
});
