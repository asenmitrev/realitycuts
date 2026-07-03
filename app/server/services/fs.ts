import fs from 'fs';
import https from 'https';
import http from 'http';
import { logger } from './logging';
import path from 'path';
import { toInternalMediaUrl } from '../config/storage';

export const safelyDelete = (path: string) => {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
};

// Function to read all files in a directory asynchronously
export function readFilesInDirectory(directoryPath: string): Promise<string[]> {
  return new Promise((res, rej) => {
    const set = new Set<string>();
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        logger.error(`Unable to read directory: + ${err}`);
        rej('Unable to read directory');
        return;
      }

      // Loop through all the files in the directory
      files.forEach(file => {
        const filePath = path.join(directoryPath, file);

        // Check if it's a file and not a directory
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          set.add(file);
        }
      });
      res([...set]);
    });
  });
}
export const safelyDeleteDir = (path: string) => {
  if (fs.existsSync(path)) {
    try {
      fs.rmSync(path, { recursive: true });
    } catch (err) {
      logger.error('Error deleting directory', { Error: err, Path: path });
    }
  }
};

const MAX_REDIRECTS = 5;

/**
 * Clean up a partial download file (best-effort, never throws).
 */
function cleanupPartialFile(filepath: string): void {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch {
    // ignore — cleanup is best-effort
  }
}

export const downloadFile = (filepath: string, publicUrl: string, maxRedirects = MAX_REDIRECTS): Promise<string> => {
  // Media URLs are stored with the browser-facing host; fetch via the internal endpoint.
  const url = toInternalMediaUrl(publicUrl);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    const request = url.startsWith('https') ? https : http;

    // Handle write stream errors (e.g., directory doesn't exist, disk full)
    file.on('error', (err) => {
      file.close();
      cleanupPartialFile(filepath);
      reject(err);
    });

    const makeRequest = (requestUrl: string, redirects: number) => {
      request
        .get(requestUrl, function (response) {
          // Follow redirects (3xx) up to maxRedirects
          if (response.statusCode && Math.floor(response.statusCode / 100) === 3 && redirects < maxRedirects) {
            response.resume(); // consume and discard response body
            response.on('end', () => {
              const location = response.headers.location;
              if (location) {
                // Resolve relative redirects against the current URL
                const resolvedUrl = new URL(location, requestUrl).toString();
                makeRequest(resolvedUrl, redirects + 1);
              } else {
                reject(new Error(`Redirect response with no Location header (status ${response.statusCode})`));
              }
            });
            return;
          }

          // Reject on non-2xx responses
          if (!response.statusCode || Math.floor(response.statusCode / 100) !== 2) {
            response.resume(); // consume and discard response body
            response.on('end', () => {
              cleanupPartialFile(filepath);
              reject(new Error(`Download failed with status ${response.statusCode} for URL: ${requestUrl}`));
            });
            return;
          }

          response.pipe(file);

          // after download completed close filestream
          file.on('finish', () => {
            file.close();
            // Verify the downloaded file has content
            try {
              const stats = fs.statSync(filepath);
              if (stats.size === 0) {
                cleanupPartialFile(filepath);
                reject(new Error(`Downloaded file is empty for URL: ${requestUrl}`));
                return;
              }
            } catch {
              cleanupPartialFile(filepath);
              reject(new Error(`Downloaded file does not exist after download for URL: ${requestUrl}`));
              return;
            }
            resolve(filepath);
          });
        })
        .on('error', function (err) {
          cleanupPartialFile(filepath);
          reject(err);
        });
    };

    makeRequest(url, 0);
  });
};
