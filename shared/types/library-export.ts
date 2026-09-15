/**
 * Library Export / Import (backup) types.
 *
 * A library export is a ZIP archive containing:
 *   manifest.json  - library document + upload records + all broll documents
 *                    (INCLUDING their vector embeddings, which are the valuable part)
 *   media/...      - every media file: broll clips, thumbnails, previews, images, raw uploads
 *
 * Importing a ZIP creates a NEW library owned by the importing user. All files are
 * re-uploaded to S3 under the importer's prefix and all metadata + vectors are
 * recreated, so the imported library is immediately searchable (vector search included).
 */

export const LIBRARY_EXPORT_FORMAT = 'videoai-library-export';
export const LIBRARY_EXPORT_VERSION = '1.0.0';

/** A single file inside the export ZIP. */
export type LibraryExportFileRef = {
  /** Path of the file inside the ZIP, e.g. "media/broll/64f1a2...mp4" */
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

/** A broll footage document plus the locations of its files inside the ZIP. */
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
  /** Number of media files actually included in the ZIP */
  fileCount: number;
  totalMediaBytes: number;
  /** Descriptions of files that were referenced but not found in S3 and therefore skipped */
  missingFiles: string[];
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
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
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
