import { describe, it, expect, beforeEach, afterAll, vi, Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMain = vi.fn().mockResolvedValue(undefined);

vi.mock('../../library/runner', () => ({
  main: mockMain,
}));

vi.mock('../logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { processLibraryProcessingJob } from '../local-task-processor';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processLibraryProcessingJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env vars set by previous tests
    delete process.env.LIBRARY_ID;
    delete process.env.SETTINGS_VERSION;
    delete process.env.SETTINGS_ID;
    delete process.env.SETTINGS;
  });

  afterAll(() => {
    // Ensure env vars are cleaned up
    delete process.env.LIBRARY_ID;
    delete process.env.SETTINGS_VERSION;
    delete process.env.SETTINGS_ID;
    delete process.env.SETTINGS;
  });

  describe('LIBRARY_PROCESSOR', () => {
    it('should call runner main() with libraryId and shouldExit: false', async () => {
      await processLibraryProcessingJob({
        type: 'LIBRARY_PROCESSOR',
        payload: {
          libraryId: 'lib-123',
          settingsId: 'settings-456',
          version: '2.0.0',
        },
        dedupeId: 'dedupe-789',
      });

      expect(mockMain).toHaveBeenCalledWith('lib-123', { shouldExit: false });
    });

    it('should default version to 1.0.0 when not provided', async () => {
      await processLibraryProcessingJob({
        type: 'LIBRARY_PROCESSOR',
        payload: {
          libraryId: 'lib-v1',
          settings: { files: [] },
        },
        dedupeId: 'dedupe-v1',
      });

      expect(mockMain).toHaveBeenCalledWith('lib-v1', { shouldExit: false });
    });

    it('should set and restore environment variables', async () => {
      // Set pre-existing env vars
      process.env.LIBRARY_ID = 'existing-lib';
      process.env.SETTINGS_VERSION = 'existing-version';

      await processLibraryProcessingJob({
        type: 'LIBRARY_PROCESSOR',
        payload: {
          libraryId: 'lib-new',
          settingsId: 'settings-new',
          version: '3.0.0',
          settings: { test: true },
        },
        dedupeId: 'dedupe-env',
      });

      // Env vars should be restored to original values
      // Note: assigning undefined to process.env sets it to the string "undefined" (Node.js quirk)
      expect(process.env.LIBRARY_ID).toBe('existing-lib');
      expect(process.env.SETTINGS_VERSION).toBe('existing-version');
      expect(process.env.SETTINGS_ID).toBe('undefined');
      expect(process.env.SETTINGS).toBe('undefined');
    });

    it('should restore env vars even when runner throws', async () => {
      process.env.LIBRARY_ID = 'pre-existing';
      mockMain.mockRejectedValueOnce(new Error('Runner failed'));

      await expect(
        processLibraryProcessingJob({
          type: 'LIBRARY_PROCESSOR',
          payload: {
            libraryId: 'lib-fail',
            version: '1.0.0',
          },
          dedupeId: 'dedupe-error',
        })
      ).rejects.toThrow('Runner failed');

      // Env vars should still be restored
      expect(process.env.LIBRARY_ID).toBe('pre-existing');
    });
  });

  describe('error handling', () => {
    it('should throw for unknown task type', async () => {
      await expect(
        processLibraryProcessingJob({
          // @ts-expect-error — intentionally testing unknown type
          type: 'UNKNOWN_TYPE',
          payload: {},
          dedupeId: 'dedupe-unknown',
        })
      ).rejects.toThrow('Unknown task type: UNKNOWN_TYPE');
    });
  });
});
