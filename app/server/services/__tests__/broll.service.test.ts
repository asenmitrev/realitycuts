import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { BrollService } from '../broll.service';
import brollRepository from '../../repositories/broll.repository';
import { NotFoundError } from '../../errors';
import { IBrollFootageMetadata } from '../../types';

// Mock the repository
vi.mock('../../repositories/broll.repository', () => ({
  default: {
    findById: vi.fn(),
    findByLibraryId: vi.fn(),
    updateByLibraryId: vi.fn(),
    findByLibraryIdAndHeuristic: vi.fn(),
    findByLibraryIdAndArollCombined: vi.fn(),
    findByLibraryIdAndBrollCombined: vi.fn(),
    findByLibraryIdAndUnknown: vi.fn()
  }
}));

describe('BrollService', () => {
  let service: BrollService;
  const mockBrollId = 'broll-123';
  const mockLibraryId = 'library-123';
  const mockBroll: IBrollFootageMetadata = {
    _id: mockBrollId,
    libraryId: mockLibraryId,
    title: 'Test Broll',
    isDeleted: false
  } as IBrollFootageMetadata;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BrollService();
  });

  describe('getBrollById', () => {
    it('should return broll footage by id', async () => {
      (brollRepository.findById as Mock).mockResolvedValue(mockBroll);

      const result = await service.getBrollById(mockBrollId);

      expect(brollRepository.findById).toHaveBeenCalledWith(mockBrollId);
      expect(result).toEqual(mockBroll);
    });

    it('should throw NotFoundError when broll not found', async () => {
      (brollRepository.findById as Mock).mockResolvedValue(null);

      await expect(service.getBrollById(mockBrollId)).rejects.toThrow(NotFoundError);
      expect(brollRepository.findById).toHaveBeenCalledWith(mockBrollId);
    });
  });

  describe('getBroll', () => {
    it('should return broll footage with default pagination', async () => {
      const mockResult = {
        broll: [mockBroll],
        total: 1
      };
      (brollRepository.findByLibraryId as Mock).mockResolvedValue(mockResult);

      const result = await service.getBroll(mockLibraryId);

      expect(brollRepository.findByLibraryId).toHaveBeenCalledWith(mockLibraryId, 0, 10);
      expect(result).toEqual(mockResult);
    });

    it('should return broll footage with custom pagination', async () => {
      const mockResult = {
        broll: [mockBroll],
        total: 1
      };
      (brollRepository.findByLibraryId as Mock).mockResolvedValue(mockResult);

      const result = await service.getBroll(mockLibraryId, 20, 5);

      expect(brollRepository.findByLibraryId).toHaveBeenCalledWith(mockLibraryId, 20, 5);
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateBrollIsPublic', () => {
    it('should update broll isPublic status by library id', async () => {
      (brollRepository.updateByLibraryId as Mock).mockResolvedValue(undefined);

      await service.updateBrollIsPublic(mockLibraryId, true);

      expect(brollRepository.updateByLibraryId).toHaveBeenCalledWith(mockLibraryId, { isPublic: true });
    });

    it('should update broll isPublic status to false', async () => {
      (brollRepository.updateByLibraryId as Mock).mockResolvedValue(undefined);

      await service.updateBrollIsPublic(mockLibraryId, false);

      expect(brollRepository.updateByLibraryId).toHaveBeenCalledWith(mockLibraryId, { isPublic: false });
    });
  });

  describe('getBrollByHeuristic', () => {
    it('should return broll by AROLL heuristic', async () => {
      const mockResult = {
        broll: [mockBroll],
        total: 1
      };
      (brollRepository.findByLibraryIdAndHeuristic as Mock).mockResolvedValue(mockResult);

      const result = await service.getBrollByHeuristic(mockLibraryId, 'AROLL', 0, 10);

      expect(brollRepository.findByLibraryIdAndHeuristic).toHaveBeenCalledWith(mockLibraryId, 'AROLL', 0, 10);
      expect(result).toEqual(mockResult);
    });

    it('should return broll by BROLL heuristic', async () => {
      const mockResult = {
        broll: [mockBroll],
        total: 1
      };
      (brollRepository.findByLibraryIdAndHeuristic as Mock).mockResolvedValue(mockResult);

      const result = await service.getBrollByHeuristic(mockLibraryId, 'BROLL', 0, 10);

      expect(brollRepository.findByLibraryIdAndHeuristic).toHaveBeenCalledWith(mockLibraryId, 'BROLL', 0, 10);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getBrollByArollCombined', () => {
    it('should return broll by combined A-roll criteria', async () => {
      const mockResult = {
        broll: [mockBroll],
        total: 1
      };
      (brollRepository.findByLibraryIdAndArollCombined as Mock).mockResolvedValue(mockResult);

      const result = await service.getBrollByArollCombined(mockLibraryId, 0, 10);

      expect(brollRepository.findByLibraryIdAndArollCombined).toHaveBeenCalledWith(mockLibraryId, 0, 10);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getBrollByBrollCombined', () => {
    it('should return broll by combined B-roll criteria', async () => {
      const mockResult = {
        broll: [mockBroll],
        total: 1
      };
      (brollRepository.findByLibraryIdAndBrollCombined as Mock).mockResolvedValue(mockResult);

      const result = await service.getBrollByBrollCombined(mockLibraryId, 0, 10);

      expect(brollRepository.findByLibraryIdAndBrollCombined).toHaveBeenCalledWith(mockLibraryId, 0, 10);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getBrollByUnknown', () => {
    it('should return unclassified broll', async () => {
      const mockResult = {
        broll: [mockBroll],
        total: 1
      };
      (brollRepository.findByLibraryIdAndUnknown as Mock).mockResolvedValue(mockResult);

      const result = await service.getBrollByUnknown(mockLibraryId, 0, 10);

      expect(brollRepository.findByLibraryIdAndUnknown).toHaveBeenCalledWith(mockLibraryId, 0, 10);
      expect(result).toEqual(mockResult);
    });
  });
});

