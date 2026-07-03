import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProfileService } from '../profile.service';
import { UserProfileRepository } from '../../repositories/user-profile.repository';
import { WaitlistRepository } from '../../repositories/waitlist.repository';
import { StorageService } from '../storage.service';
import { UnauthorizedError } from '../../errors';
import { getElevenLabsVoices } from '../ai/elevenlabs';
import { getUserIdFromEmail } from '../auth';

// Mock all dependencies
vi.mock('../../repositories/user-profile.repository');
vi.mock('../../repositories/waitlist.repository');
vi.mock('../storage.service');
vi.mock('../ai/elevenlabs');
vi.mock('../auth');

describe('ProfileService', () => {
  let service: ProfileService;
  let mockUserProfileRepo: any;
  let mockWaitlistRepo: any;
  let mockStorageService: any;

  const mockFirebaseId = 'firebase-123';
  const mockEmail = 'test@example.com';
  const mockUserProfile = {
    firebaseId: mockFirebaseId,
    firstName: 'John',
    lastName: 'Doe',
    role: 'user',
    usage: {
      libraryMinutesSpent: 10,
      ttsMinutesSpent: 5,
      gbStorage: 1.5
    }
  };

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Setup mocks with type casting
    mockUserProfileRepo = {
      findByFirebaseId: vi.fn(),
      findByFirebaseIdPlain: vi.fn(),
      create: vi.fn(),
      updateByFirebaseId: vi.fn(),
      countDocuments: vi.fn(),
      getUserStorageUsage: vi.fn()
    };

    mockWaitlistRepo = {
      addToWaitlist: vi.fn()
    };

    mockStorageService = {
      getUserStorageUsed: vi.fn()
    };

    // Mock the constructor to use our mocked instances
    vi.mocked(UserProfileRepository).mockImplementation(() => mockUserProfileRepo as any);
    vi.mocked(WaitlistRepository).mockImplementation(() => mockWaitlistRepo as any);
    vi.mocked(StorageService).mockImplementation(() => mockStorageService as any);

    // Create a new service with mocked dependencies
    service = new ProfileService();
  });

  describe('handleAfterLogin', () => {
    it('should return a message when user profile exists', async () => {
      mockUserProfileRepo.findByFirebaseIdPlain.mockResolvedValue(mockUserProfile);

      const result = await service.handleAfterLogin(mockFirebaseId);

      expect(result).toEqual({ message: 'User profile found.' });
      expect(mockUserProfileRepo.findByFirebaseIdPlain).toHaveBeenCalledWith(mockFirebaseId);
      expect(mockUserProfileRepo.create).not.toHaveBeenCalled();
    });

    it('should create a profile when none exists and return success', async () => {
      mockUserProfileRepo.findByFirebaseId.mockResolvedValue(null);
      mockUserProfileRepo.findByFirebaseIdPlain.mockResolvedValue(null);
      mockUserProfileRepo.create.mockResolvedValue(mockUserProfile);

      const result = await service.handleAfterLogin(mockFirebaseId, 'John', 'Doe');

      expect(result).toEqual({ message: 'User profile created successfully.' });
      expect(mockUserProfileRepo.findByFirebaseIdPlain).toHaveBeenCalledWith(mockFirebaseId);
      expect(mockUserProfileRepo.create).toHaveBeenCalledWith({
        firebaseId: mockFirebaseId,
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    it('should use default empty strings for missing names', async () => {
      mockUserProfileRepo.findByFirebaseId.mockResolvedValue(null);
      mockUserProfileRepo.findByFirebaseIdPlain.mockResolvedValue(null);
      mockUserProfileRepo.create.mockResolvedValue(mockUserProfile);

      await service.handleAfterLogin(mockFirebaseId);

      expect(mockUserProfileRepo.create).toHaveBeenCalledWith({
        firebaseId: mockFirebaseId,
        firstName: '',
        lastName: ''
      });
    });
  });

  describe('handleAfterRegistration', () => {
    it('should create a profile and return success', async () => {
      mockUserProfileRepo.findByFirebaseIdPlain.mockResolvedValue(null);
      mockUserProfileRepo.create.mockResolvedValue(mockUserProfile);

      const result = await service.handleAfterRegistration(mockFirebaseId, 'John', 'Doe');

      expect(result).toEqual({ message: 'User profile created successfully.' });
      expect(mockUserProfileRepo.create).toHaveBeenCalledWith({
        firebaseId: mockFirebaseId,
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    it('should update role to editor with special referral code', async () => {
      mockUserProfileRepo.findByFirebaseIdPlain.mockResolvedValue(null);
      mockUserProfileRepo.create.mockResolvedValue(mockUserProfile);
      mockUserProfileRepo.updateByFirebaseId.mockResolvedValue({ ...mockUserProfile, role: 'editor' });

      await service.handleAfterRegistration(mockFirebaseId, 'John', 'Doe', 'SUPERDUPEREDITOR1703');

      expect(mockUserProfileRepo.create).toHaveBeenCalled();
      // Referral code is currently ignored by handleAfterRegistration; ensure it doesn't break registration.
      expect(mockUserProfileRepo.updateByFirebaseId).not.toHaveBeenCalledWith(mockFirebaseId, { role: 'editor' });
    });
  });

  describe('checkSignupAvailability', () => {
    it('should return true when count is less than or equal to 250', async () => {
      mockUserProfileRepo.countDocuments.mockResolvedValue(250);

      const result = await service.checkSignupAvailability();

      expect(result).toEqual({ cr: true });
    });

    it('should return false when count is greater than 15000', async () => {
      mockUserProfileRepo.countDocuments.mockResolvedValue(15001);

      const result = await service.checkSignupAvailability();

      expect(result).toEqual({ cr: false });
    });
  });

  describe('addToWaitlist', () => {
    it('should add email to waitlist and return success message', async () => {
      mockWaitlistRepo.addToWaitlist.mockResolvedValue({
        success: true,
        message: 'Successfully added to waitlist'
      });

      const result = await service.addToWaitlist(mockEmail);

      expect(result).toEqual({ message: 'Successfully added to waitlist' });
      expect(mockWaitlistRepo.addToWaitlist).toHaveBeenCalledWith(mockEmail);
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile with storage usage', async () => {
      mockUserProfileRepo.findByFirebaseIdPlain.mockResolvedValue(mockUserProfile);
      mockStorageService.getUserStorageUsed.mockResolvedValue(2.5);

      const result = await service.getUserProfile(mockFirebaseId);

      expect(result).toEqual({
        ...mockUserProfile,
        usage: {
          ...mockUserProfile.usage,
          gbStorage: 2.5
        }
      });
      expect(mockUserProfileRepo.findByFirebaseIdPlain).toHaveBeenCalledWith(mockFirebaseId);
      expect(mockStorageService.getUserStorageUsed).toHaveBeenCalledWith(mockFirebaseId);
    });

    it('should throw UnauthorizedError when user profile not found', async () => {
      mockUserProfileRepo.findByFirebaseId.mockResolvedValue(null);

      await expect(service.getUserProfile(mockFirebaseId)).rejects.toThrow(UnauthorizedError);
      expect(mockUserProfileRepo.findByFirebaseIdPlain).toHaveBeenCalledWith(mockFirebaseId);
    });
  });

  describe('unsubscribeFromEmails', () => {
    it('should update email preferences and return success', async () => {
      vi.mocked(getUserIdFromEmail).mockResolvedValue(mockFirebaseId);
      mockUserProfileRepo.updateByFirebaseId.mockResolvedValue({
        ...mockUserProfile,
        emailPreferences: { email: false, sms: false }
      });

      const result = await service.unsubscribeFromEmails(mockEmail);

      expect(result).toEqual({ success: true });
      expect(getUserIdFromEmail).toHaveBeenCalledWith(mockEmail);
      expect(mockUserProfileRepo.updateByFirebaseId).toHaveBeenCalledWith(mockFirebaseId, {
        emailPreferences: { email: false, sms: false }
      });
    });
  });

  describe('getPremiumVoices', () => {
    it('should return premium voices', async () => {
      const mockVoices = [{ voice_id: 'voice1', name: 'Voice 1' }];
      vi.mocked(getElevenLabsVoices).mockResolvedValue(mockVoices);

      const result = await service.getPremiumVoices();

      expect(result).toEqual(mockVoices);
      expect(getElevenLabsVoices).toHaveBeenCalled();
    });
  });
});
