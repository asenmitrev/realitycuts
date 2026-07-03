import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '../auth';
import { UserProfile } from '../../models/user-profile';

// Mock UserProfile model
vi.mock('../../models/user-profile', () => ({
  UserProfile: {
    findOne: vi.fn()
  }
}));

describe('AuthService', () => {
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserEmail', () => {
    it('should return user email by user id', async () => {
      (UserProfile.findOne as vi.Mock).mockResolvedValue({ firebaseId: mockUserId, email: mockEmail });

      const result = await authService.getUserEmail(mockUserId);

      expect(UserProfile.findOne).toHaveBeenCalledWith({ firebaseId: mockUserId });
      expect(result).toBe(mockEmail);
    });

    it('should return undefined when user not found', async () => {
      (UserProfile.findOne as vi.Mock).mockResolvedValue(null);

      const result = await authService.getUserEmail(mockUserId);

      expect(result).toBeUndefined();
    });
  });

  describe('getUserIdFromEmail', () => {
    it('should return user id by email', async () => {
      (UserProfile.findOne as vi.Mock).mockResolvedValue({ firebaseId: mockUserId, email: mockEmail });

      const result = await authService.getUserIdFromEmail(mockEmail);

      expect(UserProfile.findOne).toHaveBeenCalledWith({ email: mockEmail });
      expect(result).toBe(mockUserId);
    });

    it('should return undefined when email not found', async () => {
      (UserProfile.findOne as vi.Mock).mockResolvedValue(null);

      const result = await authService.getUserIdFromEmail(mockEmail);

      expect(result).toBeUndefined();
    });
  });
});
