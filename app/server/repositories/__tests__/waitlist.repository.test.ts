import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Waitlist } from '../../models/waitlist';
import { WaitlistRepository } from '../waitlist.repository';

// Mock the Waitlist model
vi.mock('../../models/waitlist');

describe('WaitlistRepository', () => {
  let repository: WaitlistRepository;
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    repository = new WaitlistRepository();
    vi.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should find a waitlist entry by email', async () => {
      const mockEntry = { email: mockEmail };
      (Waitlist.findOne as any).mockResolvedValue(mockEntry);

      const result = await repository.findByEmail(mockEmail);

      expect(result).toEqual(mockEntry);
      expect(Waitlist.findOne).toHaveBeenCalledWith({ email: mockEmail.toLowerCase().trim() });
    });
  });

  describe('create', () => {
    it('should create a new waitlist entry', async () => {
      const mockEntry = { email: mockEmail };
      (Waitlist.create as any).mockResolvedValue(mockEntry);

      const result = await repository.create(mockEmail);

      expect(result).toEqual(mockEntry);
      expect(Waitlist.create).toHaveBeenCalledWith({ email: mockEmail });
    });
  });

  describe('addToWaitlist', () => {
    it('should return success message when email is added to waitlist', async () => {
      // Mock the findByEmail method to return null (no existing entry)
      vi.spyOn(repository, 'findByEmail').mockResolvedValue(null);

      // Mock the create method
      vi.spyOn(repository, 'create').mockResolvedValue({ email: mockEmail });

      const result = await repository.addToWaitlist(mockEmail);

      expect(result).toEqual({
        success: true,
        message: 'Successfully added to waitlist'
      });
      expect(repository.findByEmail).toHaveBeenCalledWith(mockEmail);
      expect(repository.create).toHaveBeenCalledWith(mockEmail);
    });

    it('should return error message when email already exists', async () => {
      // Mock the findByEmail method to return an existing entry
      vi.spyOn(repository, 'findByEmail').mockResolvedValue({ email: mockEmail });

      const result = await repository.addToWaitlist(mockEmail);

      expect(result).toEqual({
        success: false,
        message: 'This email is already on the waitlist'
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock the findByEmail method to throw an error
      vi.spyOn(repository, 'findByEmail').mockRejectedValue(new Error('Database error'));

      const result = await repository.addToWaitlist(mockEmail);

      expect(result).toEqual({
        success: false,
        message: 'Error adding to waitlist'
      });
    });
  });
});
