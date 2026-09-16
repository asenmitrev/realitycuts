import mongoose from 'mongoose';
import './define-getters';

/**
 * Tracks an async library IMPORT (backup restore) job. (This branch has no EXPORT
 * feature of its own — `direction` also allows 'EXPORT' only because it's shared with
 * videoai's job status payload shape; it's never created here.)
 *
 * IMPORT consumes a manifest.json + one or more part ZIPs (see
 * shared/types/library-export.ts), recreating the library (new IDs, re-uploaded
 * files, preserved vectors) for the importing user.
 *
 * Jobs run on BullMQ workers. If the worker process restarts mid-job,
 * `cleanupStaleImportJobs()` (called at boot) fails them and cleans up partial imports.
 */
const libraryExportJobSchema = new mongoose.Schema(
  {
    direction: {
      type: String,
      enum: ['EXPORT', 'IMPORT'],
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    // EXPORT: the library being exported
    sourceLibraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Library',
      default: null
    },
    // IMPORT: the newly created library (set as soon as it exists)
    newLibraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Library',
      default: null
    },
    status: {
      type: String,
      enum: ['AWAITING_UPLOAD', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'AWAITING_UPLOAD',
      index: true
    },
    // IMPORT only: number of part ZIPs the client is expected to upload before
    // finalize() enqueues the job. Set at /import/init time from the manifest.
    expectedParts: {
      type: Number,
      default: 0
    },
    error: {
      type: String,
      default: null
    },
    progress: {
      type: Number,
      default: 0
    },
    stats: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    // S3 prefix the uploaded backup files (manifest.json, part{n}.zip, ...) were stashed
    // under while the job is processed (deleted, along with everything under it, once
    // the job finishes — success or failure).
    importS3Prefix: {
      type: String,
      default: null
    },
    fileName: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

export const LibraryExportJob = mongoose.model('LibraryExportJob', libraryExportJobSchema);
