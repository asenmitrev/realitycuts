import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { archiveDirectory } from '../archiver';
import fs from 'fs';
import archiver from 'archiver';

vi.mock('fs', () => ({
  default: {
    createWriteStream: vi.fn()
  }
}));

vi.mock('archiver', () => ({
  default: vi.fn()
}));

describe('ArchiverService', () => {
  const mockSourcePath = '/path/to/source';
  const mockOutputPath = '/path/to/output.zip';
  let mockWriteStream: any;
  let mockArchive: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWriteStream = {
      on: vi.fn(),
      close: vi.fn()
    };

    mockArchive = {
      pipe: vi.fn(),
      directory: vi.fn(),
      finalize: vi.fn(),
      on: vi.fn(),
      pointer: vi.fn().mockReturnValue(1024)
    };

    (fs.createWriteStream as Mock).mockReturnValue(mockWriteStream);
    (archiver as Mock).mockReturnValue(mockArchive);
  });

  describe('archiveDirectory', () => {
    it('should create archive successfully', async () => {
      mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(), 0);
        }
      });

      const result = await archiveDirectory(mockSourcePath, mockOutputPath);

      expect(fs.createWriteStream).toHaveBeenCalledWith(mockOutputPath);
      expect(archiver).toHaveBeenCalledWith('zip', {
        zlib: { level: 0 },
        statConcurrency: 1,
        highWaterMark: 16 * 1024
      });
      expect(mockArchive.pipe).toHaveBeenCalledWith(mockWriteStream);
      expect(mockArchive.directory).toHaveBeenCalledWith(mockSourcePath, false);
      expect(mockArchive.finalize).toHaveBeenCalled();
      expect(result).toEqual({
        size: 1024,
        path: mockOutputPath
      });
    });

    it('should handle archive errors', async () => {
      const error = new Error('Archive error');
      mockArchive.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(error), 0);
        }
      });
      mockWriteStream.on.mockImplementation((event: string) => {
        if (event === 'close') {
          // Don't call callback to simulate error
        }
      });

      await expect(archiveDirectory(mockSourcePath, mockOutputPath)).rejects.toThrow('Archive error');
    });

    it('should set correct archive options', async () => {
      mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(), 0);
        }
      });

      await archiveDirectory(mockSourcePath, mockOutputPath);

      expect(archiver).toHaveBeenCalledWith('zip', {
        zlib: {
          level: 0
        },
        statConcurrency: 1,
        highWaterMark: 16 * 1024
      });
    });
  });
});
