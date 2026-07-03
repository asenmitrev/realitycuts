import fs from 'fs';
import archiver from 'archiver';

export const archiveDirectory = (sourcePath: string, outputPath: string) => {
  return new Promise((resolve, reject) => {
    // Create write stream
    const output = fs.createWriteStream(outputPath);

    // Create archiver instance
    const archive = archiver('zip', {
      zlib: {
        level: 0
      },
      // Optimize for performance
      statConcurrency: 1, // Limit concurrent stat operations
      highWaterMark: 16 * 1024 // Adjust buffer size
    });

    // Listen for all archive data to be written
    output.on('close', () => {
      resolve({
        size: archive.pointer(),
        path: outputPath
      });
    });

    // Handle errors
    archive.on('error', (err: unknown) => {
      reject(err);
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Add entire directory
    archive.directory(sourcePath, false);

    // Finalize the archive
    archive.finalize();
  });
};
