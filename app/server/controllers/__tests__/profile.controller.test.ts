import { vi, describe, Mock, it, expect, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Create mock service
// Mock ProfileService to return our mock instance
vi.mock('../../services/profile.service');

vi.mock('../../services/logging');

// Import after mocks are set up
import { AuthenticatedRequest } from '../../types';
import { logger } from '../../services/logging';
import profileController from '../profile.controller';
import profileService from '../../services/profile.service';

const mockProfileService = profileService;
describe('Profile Controller', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock request and response
    mockReq = {
      body: {},
      user: { user_id: 'firebase-123' }
    };

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };
  });

  describe('afterLogin', () => {
    it('should handle successful login', async () => {
      mockReq.body = {
        firebaseId: 'firebase-123',
        firstName: 'John',
        lastName: 'Doe'
      };

      (mockProfileService.handleAfterLogin as Mock).mockResolvedValue({ message: 'User profile found.' });

      await profileController.afterLogin(mockReq as any, mockRes as any);

      expect(logger.info).toHaveBeenCalledWith('User logged in', {
        'User ID': 'firebase-123'
      });

      expect(mockProfileService.handleAfterLogin).toHaveBeenCalledWith('firebase-123', 'John', 'Doe', undefined);

      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User profile found.' });
    });
  });

  describe('afterReg', () => {
    it('should handle successful registration', async () => {
      mockReq.body = {
        firebaseId: 'firebase-123',
        firstName: 'John',
        lastName: 'Doe',
        referralCode: 'SOMEREFCODE'
      };

      (mockProfileService.handleAfterRegistration as Mock).mockResolvedValue({
        message: 'User profile created successfully.'
      });

      await profileController.afterReg(mockReq as any, mockRes as any);

      expect(logger.info).toHaveBeenCalledWith('Creating new user profile', {
        'User ID': 'firebase-123'
      });

      expect(mockProfileService.handleAfterRegistration).toHaveBeenCalledWith(
        'firebase-123',
        'John',
        'Doe',
        'SOMEREFCODE'
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'User profile created successfully.'
      });
    });
  });

  describe('cr', () => {
    it('should return signup availability', async () => {
      (mockProfileService.checkSignupAvailability as Mock).mockResolvedValue({ cr: true });

      await profileController.cr(mockReq as any, mockRes as any);

      expect(mockProfileService.checkSignupAvailability).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({ cr: true });
    });
  });

  describe('waitlist', () => {
    it('should add email to waitlist', async () => {
      mockReq.body = { email: 'test@example.com' };

      (mockProfileService.addToWaitlist as Mock).mockResolvedValue({
        message: 'Successfully added to waitlist'
      });

      await profileController.waitlist(mockReq as any, mockRes as any);

      expect(mockProfileService.addToWaitlist).toHaveBeenCalledWith('test@example.com');
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Successfully added to waitlist' });
    });
  });

  describe('profile', () => {
    it('should return user profile', async () => {
      const mockProfile = {
        firebaseId: 'firebase-123',
        firstName: 'John',
        lastName: 'Doe',
        usage: { gbStorage: 1.5 }
      };

      (mockProfileService.getUserProfile as Mock).mockResolvedValue(mockProfile);

      await profileController.profile(mockReq as any, mockRes as any);

      expect(mockProfileService.getUserProfile).toHaveBeenCalledWith('firebase-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockProfile);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe user from emails', async () => {
      mockReq.body = { email: 'test@example.com' };

      (mockProfileService.unsubscribeFromEmails as Mock).mockResolvedValue({ success: true });

      await profileController.unsubscribe(mockReq as any, mockRes as any);

      expect(mockProfileService.unsubscribeFromEmails).toHaveBeenCalledWith('test@example.com');
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('premiumVoices', () => {
    it('should return premium voices', async () => {
      const mockVoices = [{ voice_id: 'voice1', name: 'Voice 1' }];

      (mockProfileService.getPremiumVoices as Mock).mockResolvedValue(mockVoices);

      await profileController.premiumVoices(mockReq as any, mockRes as any);

      expect(mockProfileService.getPremiumVoices).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockVoices);
    });
  });
});
