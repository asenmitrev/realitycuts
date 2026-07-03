import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import PreUserPrompt from '../../models/preuser-prompt';
import {
  createPreUserPrompt,
  findPreUserPromptByToken,
  deletePreUserPromptByToken
} from '../preuser-prompt.repository';
import { IPreUserPrompt } from '../../models/preuser-prompt';

vi.mock('../../models/preuser-prompt', () => ({
  default: {
    create: vi.fn(),
    findOne: vi.fn(),
    deleteOne: vi.fn()
  }
}));

describe('PreUserPromptRepository', () => {
  const mockToken = 'token-123';
  const mockPrompt = 'Test prompt';
  const mockLibraryIds = 'library-1,library-2';

  const mockPreUserPrompt: Partial<IPreUserPrompt> = {
    _id: 'preuser-prompt-123',
    token: mockToken,
    prompt: mockPrompt,
    libraryIds: mockLibraryIds,
    createdAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPreUserPrompt', () => {
    it('should create a new pre-user prompt', async () => {
      (PreUserPrompt.create as Mock).mockResolvedValue(mockPreUserPrompt);

      const result = await createPreUserPrompt(mockToken, mockPrompt, mockLibraryIds);

      expect(PreUserPrompt.create).toHaveBeenCalledWith({
        token: mockToken,
        prompt: mockPrompt,
        libraryIds: mockLibraryIds
      });
      expect(result).toEqual(mockPreUserPrompt);
    });

    it('should create pre-user prompt without libraryIds', async () => {
      (PreUserPrompt.create as Mock).mockResolvedValue({
        ...mockPreUserPrompt,
        libraryIds: undefined
      });

      const result = await createPreUserPrompt(mockToken, mockPrompt);

      expect(PreUserPrompt.create).toHaveBeenCalledWith({
        token: mockToken,
        prompt: mockPrompt,
        libraryIds: undefined
      });
      expect(result).toBeDefined();
    });
  });

  describe('findPreUserPromptByToken', () => {
    it('should find pre-user prompt by token', async () => {
      (PreUserPrompt.findOne as Mock).mockResolvedValue(mockPreUserPrompt);

      const result = await findPreUserPromptByToken(mockToken);

      expect(PreUserPrompt.findOne).toHaveBeenCalledWith({ token: mockToken });
      expect(result).toEqual(mockPreUserPrompt);
    });

    it('should return null when prompt not found', async () => {
      (PreUserPrompt.findOne as Mock).mockResolvedValue(null);

      const result = await findPreUserPromptByToken('non-existent-token');

      expect(result).toBeNull();
    });
  });

  describe('deletePreUserPromptByToken', () => {
    it('should delete pre-user prompt by token', async () => {
      (PreUserPrompt.deleteOne as Mock).mockResolvedValue({ deletedCount: 1 });

      await deletePreUserPromptByToken(mockToken);

      expect(PreUserPrompt.deleteOne).toHaveBeenCalledWith({ token: mockToken });
    });

    it('should handle deletion when prompt does not exist', async () => {
      (PreUserPrompt.deleteOne as Mock).mockResolvedValue({ deletedCount: 0 });

      await deletePreUserPromptByToken('non-existent-token');

      expect(PreUserPrompt.deleteOne).toHaveBeenCalledWith({ token: 'non-existent-token' });
    });
  });
});

