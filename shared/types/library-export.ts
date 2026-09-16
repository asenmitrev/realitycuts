/**
 * Library Export / Import (backup) types.
 *
 * This repo has no export feature of its own — it only ever consumes backups produced
 * by videoai's export feature. A backup is a set of files uploaded together:
 *   manifest.json      - library document + upload records + all broll documents
 *                        (INCLUDING their vector embeddings, which are the valuable part)
 *   part-0.zip, ...    - broll media files (clips, thumbnails, previews, images), split
 *                        across multiple ZIP parts. Raw upload files are not packed -
 *                        only their metadata is kept in the manifest (`uploads[].file`
 *                        is always null).
 *
 * Part filenames are 0-based (`part-0.zip` is the first part) — see
 * LIBRARY_EXPORT_PART_FILENAME_REGEX. Backups taken with the previous (pre-chunked,
 * single-outer-ZIP) videoai export are still accepted via
 * LIBRARY_EXPORT_LEGACY_PART_FILENAME_REGEX, whose part numbers are 1-based.
 *
 * Importing creates a NEW library owned by the importing user. All files are
 * re-uploaded to S3 under the importer's prefix and all metadata + vectors are
 * recreated, so the imported library is immediately searchable (vector search included).
 */

export const LIBRARY_EXPORT_FORMAT = 'videoai-library-export';
/**
 * Informational only — nothing in the import pipeline enforces this against the
 * manifest's `version` field (only `format` is checked). Kept roughly in sync with
 * videoai's export version as a human-readable compatibility hint.
 */
export const LIBRARY_EXPORT_VERSION = '2.1.0';

/** Matches the current export's part filenames: part-0.zip, part-1.zip, ... (0-based). */
export const LIBRARY_EXPORT_PART_FILENAME_REGEX = /^part-(\d+)\.zip$/i;

/**
 * Matches part filenames from the previous (pre-chunked) videoai export, e.g.
 * my-library-export-part1.zip (1-based). Kept so backups taken before the export
 * rewrite can still be restored.
 */
export const LIBRARY_EXPORT_LEGACY_PART_FILENAME_REGEX = /-export-part(\d+)\.zip$/i;

/** A single file inside one of the backup's ZIP parts. */
export type LibraryExportFileRef = {
  /** Index (0-based) of the ZIP part this file lives in */
  part: number;
  /** Path of the file inside that ZIP part, e.g. "media/broll/64f1a2.../video.mp4" */
  path: string;
  /** S3 key the file was read from (used to derive the extension / reference only) */
  s3Key: string;
  /** Size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
};

export type LibraryExportBrollFiles = {
  video?: LibraryExportFileRef | null;
  thumbnail?: LibraryExportFileRef | null;
  thumbnail2?: LibraryExportFileRef | null;
  preview?: LibraryExportFileRef | null;
  image?: LibraryExportFileRef | null;
};

/** A broll footage document plus the locations of its files inside the ZIP parts. */
export type LibraryExportBroll = {
  /** Original broll _id (a fresh id is generated on import) */
  id: string;
  files: LibraryExportBrollFiles;
  /**
   * The full broll document (everything except _id/libraryId), including
   * `videoEmbedding`. Imported verbatim so the library is immediately vector-searchable.
   */
  data: Record<string, any>;
};

/** A raw upload (a file the user originally uploaded) plus its file location in the ZIP. */
export type LibraryExportUpload = {
  /** Original upload _id */
  id: string;
  file: LibraryExportFileRef | null;
  /** The prompt attached to this upload in library.processedFiles (if any) */
  prompt?: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  duration?: number;
};

export type LibraryExportLibrary = {
  title: string;
  description?: string;
  isPublic: boolean;
  tags?: string[];
  youtubeDownloads?: {
    sourceUrl: string;
    downloadUrl: string;
    description?: string;
    status: 'NEW' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  }[];
  clusteringMetadata?: Record<string, any>;
};

export type LibraryExportStats = {
  brollCount: number;
  uploadCount: number;
  /** Number of broll media files actually included across all ZIP parts */
  fileCount: number;
  totalMediaBytes: number;
  /** Descriptions of files that were referenced but not found in storage and therefore skipped */
  missingFiles: string[];
  /** Number of ZIP parts the broll media is split across */
  totalParts: number;
};

export type LibraryExportManifest = {
  format: typeof LIBRARY_EXPORT_FORMAT;
  version: typeof LIBRARY_EXPORT_VERSION;
  exportedAt: string;
  source: {
    environment: string;
    libraryId: string;
    userId: string;
  };
  library: LibraryExportLibrary;
  uploads: LibraryExportUpload[];
  brolls: LibraryExportBroll[];
  stats: LibraryExportStats;
};

/**
 * Progress + result payload for an in-flight or finished transfer job
 * (the same shape is returned by both export and import status endpoints).
 */
export type LibraryTransferJobData = {
  _id: string;
  direction: 'EXPORT' | 'IMPORT';
  userId: string;
  /** Export: the library being exported. Import: null. */
  sourceLibraryId?: string | null;
  /** Import: the newly created library (set as soon as it exists). */
  newLibraryId?: string | null;
  /**
   * IMPORT only: 'AWAITING_UPLOAD' is the initial state, between /import/init and
   * /import/:jobId/finalize, while the client is PUTting part ZIPs directly to
   * storage one at a time.
   */
  status: 'AWAITING_UPLOAD' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error?: string | null;
  /** 0..1 */
  progress: number;
  stats?: Record<string, any> | null;
  /** Export only: presigned download URL for the finished ZIP (24h expiry). */
  downloadUrl?: string | null;
  fileName?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

/** Body of POST /api/library/import/init — the manifest is sent first, on its own. */
export type LibraryImportInitRequest = {
  manifest: LibraryExportManifest;
};

/**
 * Response to POST /api/library/import/init: a job id plus one presigned PUT URL per
 * part, index-aligned (partUploadUrls[i] uploads part{i}.zip). The client PUTs each
 * part directly to storage, one at a time, then calls POST /import/:jobId/finalize.
 * Nothing but the small manifest.json ever passes through the app server itself.
 */
export type LibraryImportInitResponse = {
  jobId: string;
  partUploadUrls: string[];
};
