import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import * as fsService from '../fs';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { logger } from '../logging';

// Mock dependencies
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdir: vi.fn(),
    statSync: vi.fn(),
    createWriteStream: vi.fn(),
    unlink: vi.fn(),
    rmSync: vi.fn()
  }
}));

vi.mock('https', () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock('http', () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock('../logging', () => ({
  logger: {
    error: vi.fn()
  }
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/'))
  }
}));

describe('FsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('safelyDelete', () => {
    it('should delete file when it exists', () => {
      const filePath = '/path/to/file.txt';
      (fs.existsSync as Mock).mockReturnValue(true);

      fsService.safelyDelete(filePath);

      expect(fs.existsSync).toHaveBeenCalledWith(filePath);
      expect(fs.unlinkSync).toHaveBeenCalledWith(filePath);
    });

    it('should not delete file when it does not exist', () => {
      const filePath = '/path/to/file.txt';
      (fs.existsSync as Mock).mockReturnValue(false);

      fsService.safelyDelete(filePath);

      expect(fs.existsSync).toHaveBeenCalledWith(filePath);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('safelyDeleteDir', () => {
    it('should delete directory when it exists', () => {
      const dirPath = '/path/to/dir';
      (fs.existsSync as Mock).mockReturnValue(true);
      (fs.rmSync as Mock).mockReturnValue(undefined);

      fsService.safelyDeleteDir(dirPath);

      expect(fs.existsSync).toHaveBeenCalledWith(dirPath);
      expect(fs.rmSync).toHaveBeenCalledWith(dirPath, { recursive: true });
    });

    it('should not delete directory when it does not exist', () => {
      const dirPath = '/path/to/dir';
      (fs.existsSync as Mock).mockReturnValue(false);

      fsService.safelyDeleteDir(dirPath);

      expect(fs.existsSync).toHaveBeenCalledWith(dirPath);
      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it('should handle errors when deleting directory', () => {
      const dirPath = '/path/to/dir';
      const error = new Error('Permission denied');
      (fs.existsSync as Mock).mockReturnValue(true);
      (fs.rmSync as Mock).mockImplementation(() => {
        throw error;
      });

      expect(() => fsService.safelyDeleteDir(dirPath)).not.toThrow();
      expect(logger.error).toHaveBeenCalledWith('Error deleting directory', {
        Error: error,
        Path: dirPath
      });
    });
  });

  describe('readFilesInDirectory', () => {
    it('should return list of files in directory', async () => {
      const directoryPath = '/path/to/dir';
      const files = ['file1.txt', 'file2.txt', 'subdir'];
      const mockStats = {
        isFile: vi.fn((file) => file !== 'subdir')
      };

      (fs.readdir as Mock).mockImplementation((path, callback) => {
        callback(null, files);
      });
      (fs.statSync as Mock).mockImplementation((filePath) => {
        const fileName = filePath.split('/').pop();
        return {
          isFile: () => fileName !== 'subdir'
        };
      });

      const result = await fsService.readFilesInDirectory(directoryPath);

      expect(fs.readdir).toHaveBeenCalled();
      expect(result).toEqual(['file1.txt', 'file2.txt']);
    });

    it('should handle errors when reading directory', async () => {
      const directoryPath = '/path/to/dir';
      const error = new Error('Permission denied');

      (fs.readdir as Mock).mockImplementation((path, callback) => {
        callback(error, null);
      });

      await expect(fsService.readFilesInDirectory(directoryPath)).rejects.toBe('Unable to read directory');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return empty array when directory is empty', async () => {
      const directoryPath = '/path/to/dir';

      (fs.readdir as Mock).mockImplementation((path, callback) => {
        callback(null, []);
      });

      const result = await fsService.readFilesInDirectory(directoryPath);

      expect(result).toEqual([]);
    });
  });

  describe('downloadFile', () => {
    it('should download file from https URL', async () => {
      const filepath = '/path/to/downloaded-file.mp4';
      const url = 'https://example.com/file.mp4';
      const mockWriteStream = {
        on: vi.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(() => callback(), 0);
          }
          return mockWriteStream;
        }),
        close: vi.fn()
      };
      const mockResponse = {
        statusCode: 200,
        resume: vi.fn(),
        pipe: vi.fn()
      };

      (fs.createWriteStream as Mock).mockReturnValue(mockWriteStream);
      (fs.statSync as Mock).mockReturnValue({ size: 12345 });
      (https.get as Mock).mockImplementation((url, callback) => {
        callback(mockResponse);
        return {
          on: vi.fn()
        };
      });

      const result = await fsService.downloadFile(filepath, url);

      expect(fs.createWriteStream).toHaveBeenCalledWith(filepath);
      expect(https.get).toHaveBeenCalled();
      expect(mockResponse.pipe).toHaveBeenCalledWith(mockWriteStream);
      expect(result).toBe(filepath);
    });

    it('should download file from http URL', async () => {
      const filepath = '/path/to/downloaded-file.mp4';
      const url = 'http://example.com/file.mp4';
      const mockWriteStream = {
        on: vi.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(() => callback(), 0);
          }
          return mockWriteStream;
        }),
        close: vi.fn()
      };
      const mockResponse = {
        statusCode: 200,
        resume: vi.fn(),
        pipe: vi.fn()
      };

      (fs.createWriteStream as Mock).mockReturnValue(mockWriteStream);
      (fs.statSync as Mock).mockReturnValue({ size: 12345 });
      (http.get as Mock).mockImplementation((url, callback) => {
        callback(mockResponse);
        return {
          on: vi.fn()
        };
      });

      const result = await fsService.downloadFile(filepath, url);

      expect(http.get).toHaveBeenCalled();
      expect(result).toBe(filepath);
    });

    it('should handle errors when downloading fails', async () => {
      const filepath = '/path/to/downloaded-file.mp4';
      const url = 'https://example.com/file.mp4';
      const error = new Error('Network error');

      (fs.createWriteStream as Mock).mockReturnValue({
        on: vi.fn()
      });
      (fs.existsSync as Mock).mockReturnValue(true);
      (https.get as Mock).mockImplementation((url, callback) => {
        return {
          on: vi.fn((event, errorCallback) => {
            if (event === 'error') {
              setTimeout(() => errorCallback(error), 0);
            }
          })
        };
      });

      await expect(fsService.downloadFile(filepath, url)).rejects.toThrow('Network error');
      expect(fs.existsSync).toHaveBeenCalledWith(filepath);
      expect(fs.unlinkSync).toHaveBeenCalledWith(filepath);
    });
  });
});

