import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import * as preuserPromptService from '../preuser-prompt.service';
import * as repo from '../../repositories/preuser-prompt.repository';

// Mock the repository
vi.mock('../../repositories/preuser-prompt.repository', () => ({
  createPreUserPrompt: vi.fn(),
  findPreUserPromptByToken: vi.fn(),
  deletePreUserPromptByToken: vi.fn()
}));

vi.mock('../../agents/library-name.agent', () => ({
  generateLibraryName: vi.fn().mockResolvedValue('Mock Library Name')
}));

vi.mock('../../repositories/library.repository', () => ({
  default: {
    update: vi.fn(),
    updateBrollIsPublicByLibraryId: vi.fn()
  }
}));

describe('PreUserPromptService', () => {
  const mockToken = 'test-token-123';
  const mockPrompt = 'Test prompt';
  const mockLibraryIds = 'library-1,library-2';
  const mockRecord = {
    token: mockToken,
    prompt: mockPrompt,
    libraryIds: mockLibraryIds
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPrompt', () => {
    it('should create a prompt and return token and prompt', async () => {
      (repo.createPreUserPrompt as Mock).mockResolvedValue(mockRecord);

      const result = await preuserPromptService.createPrompt(mockPrompt, mockLibraryIds);

      expect(repo.createPreUserPrompt).toHaveBeenCalledWith(expect.any(String), mockPrompt, mockLibraryIds, 'Mock Library Name');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('prompt', mockPrompt);
      expect(typeof result.token).toBe('string');
    });

    it('should create a prompt without libraryIds', async () => {
      (repo.createPreUserPrompt as Mock).mockResolvedValue({ ...mockRecord, libraryIds: undefined });

      const result = await preuserPromptService.createPrompt(mockPrompt);

      expect(repo.createPreUserPrompt).toHaveBeenCalledWith(expect.any(String), mockPrompt, undefined, undefined);
      expect(result.prompt).toBe(mockPrompt);
    });

    it('should generate unique tokens for each prompt', async () => {
      (repo.createPreUserPrompt as Mock).mockResolvedValue(mockRecord);

      const result1 = await preuserPromptService.createPrompt('Prompt 1');
      const result2 = await preuserPromptService.createPrompt('Prompt 2');

      expect(result1.token).not.toBe(result2.token);
    });
  });

  describe('getPrompt', () => {
    it('should return prompt record by token', async () => {
      (repo.findPreUserPromptByToken as Mock).mockResolvedValue(mockRecord);

      const result = await preuserPromptService.getPrompt(mockToken);

      expect(repo.findPreUserPromptByToken).toHaveBeenCalledWith(mockToken);
      expect(result).toEqual(mockRecord);
    });

    it('should return null when prompt not found', async () => {
      (repo.findPreUserPromptByToken as Mock).mockResolvedValue(null);

      const result = await preuserPromptService.getPrompt('non-existent-token');

      expect(result).toBeNull();
    });
  });

  describe('consumePrompt', () => {
    it('should return prompt and delete record when found', async () => {
      (repo.findPreUserPromptByToken as Mock).mockResolvedValue(mockRecord);
      (repo.deletePreUserPromptByToken as Mock).mockResolvedValue(undefined);

      const result = await preuserPromptService.consumePrompt(mockToken);

      expect(repo.findPreUserPromptByToken).toHaveBeenCalledWith(mockToken);
      expect(repo.deletePreUserPromptByToken).toHaveBeenCalledWith(mockToken);
      expect(result).toBe(mockPrompt);
    });

    it('should return null when prompt not found', async () => {
      (repo.findPreUserPromptByToken as Mock).mockResolvedValue(null);

      const result = await preuserPromptService.consumePrompt('non-existent-token');

      expect(repo.findPreUserPromptByToken).toHaveBeenCalledWith('non-existent-token');
      expect(repo.deletePreUserPromptByToken).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should delete record even if prompt is empty string', async () => {
      const emptyPromptRecord = { ...mockRecord, prompt: '' };
      (repo.findPreUserPromptByToken as Mock).mockResolvedValue(emptyPromptRecord);
      (repo.deletePreUserPromptByToken as Mock).mockResolvedValue(undefined);

      const result = await preuserPromptService.consumePrompt(mockToken);

      expect(repo.deletePreUserPromptByToken).toHaveBeenCalledWith(mockToken);
      expect(result).toBe('');
    });
  });
});

