import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserProfile } from '../../models/user-profile';
import { IUserProfile } from '../../types/index';
import { UserProfileRepository } from '../user-profile.repository';

// Mock the UserProfile model
vi.mock('../../models/user-profile');

describe('UserProfileRepository', () => {
  let repository: UserProfileRepository;
  const mockFirebaseId = 'firebase-123';
  const mockProfileData: Partial<IUserProfile> = {
    firebaseId: mockFirebaseId,
    firstName: 'John',
    lastName: 'Doe',
    role: 'user'
  };

  beforeEach(() => {
    repository = new UserProfileRepository();
    vi.clearAllMocks();
  });

  describe('findByFirebaseId', () => {
    it('should return null when no profile is found', async () => {
      (UserProfile.findOne as any).mockResolvedValue(null);

      const result = await repository.findByFirebaseId(mockFirebaseId);

      expect(result).toBeNull();
      expect(UserProfile.findOne).toHaveBeenCalledWith({ firebaseId: mockFirebaseId });
    });

    it('should return a profile when found', async () => {
      const mockProfile = {
        ...mockProfileData,
        toJSON: vi.fn().mockReturnValue(mockProfileData)
      };

      (UserProfile.findOne as any).mockResolvedValue(mockProfile);

      const result = await repository.findByFirebaseIdPlain(mockFirebaseId);

      expect(result).toEqual(mockProfileData);
      expect(UserProfile.findOne).toHaveBeenCalledWith({ firebaseId: mockFirebaseId });
      expect(mockProfile.toJSON).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create and return a new user profile', async () => {
      const mockSave = vi.fn().mockResolvedValue({
        ...mockProfileData,
        toJSON: vi.fn().mockReturnValue(mockProfileData)
      });

      // Mock the constructor and save method
      const mockUserProfile = {
        save: mockSave,
        toJSON: vi.fn().mockReturnValue(mockProfileData)
      };

      // @ts-ignore - Mock the constructor
      UserProfile.mockImplementation(() => mockUserProfile);

      const result = await repository.create(mockProfileData);

      expect(result).toEqual(mockProfileData);
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('updateByFirebaseId', () => {
    it('should update and return the user profile', async () => {
      const updateData = { firstName: 'Jane' };
      const updatedProfile = {
        ...mockProfileData,
        firstName: 'Jane',
        toJSON: vi.fn().mockReturnValue({ ...mockProfileData, firstName: 'Jane' })
      };

      (UserProfile.findOneAndUpdate as any).mockResolvedValue(updatedProfile);

      const result = await repository.updateByFirebaseId(mockFirebaseId, updateData);

      expect(result).toEqual({ ...mockProfileData, firstName: 'Jane' });
      expect(UserProfile.findOneAndUpdate).toHaveBeenCalledWith(
        { firebaseId: mockFirebaseId },
        { $set: updateData },
        { new: true }
      );
    });

    it('should return null when no profile is found to update', async () => {
      (UserProfile.findOneAndUpdate as any).mockResolvedValue(null);

      const result = await repository.updateByFirebaseId(mockFirebaseId, { firstName: 'Jane' });

      expect(result).toBeNull();
    });
  });

  describe('countDocuments', () => {
    it('should return the count of user profiles', async () => {
      (UserProfile.countDocuments as any).mockResolvedValue(42);

      const result = await repository.countDocuments();

      expect(result).toBe(42);
      expect(UserProfile.countDocuments).toHaveBeenCalled();
    });
  });
});
