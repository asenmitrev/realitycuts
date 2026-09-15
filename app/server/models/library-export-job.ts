import mongoose from 'mongoose';
import './define-getters';

/**
 * Tracks an async library EXPORT or IMPORT (backup) job.
 *
 * - EXPORT: builds a ZIP (manifest + all media files + vectors), uploads it to
 *   private S3 and makes it available via presigned URL.
 * - IMPORT: consumes such a ZIP, recreating the library (new IDs, re-uploaded
 *   files, preserved vectors) for the importing user.
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
      enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'QUEUED',
      index: true
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
    // EXPORT: S3 key of the finished ZIP (presigned URL is derived on demand).
    // IMPORT: S3 key of the temp uploaded ZIP being processed (deleted when the job finishes).
    zipS3Key: {
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
