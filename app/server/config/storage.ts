// --- MinIO / S3-compatible storage config ---
export const S3_BUCKET = process.env.MINIO_BUCKET ?? '1703-media-app-2';
export const S3_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'http://localhost:9000';
export const S3_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? 'minioadmin';
export const S3_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? 'minioadmin';
export const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL ?? 'http://localhost:9000';
// Browser-reachable endpoint for presigned URLs. Inside docker compose the
// server talks to MinIO via http://minio:9000, but URLs handed to the browser
// must use the host-published address, and the v4 signature covers the host.
export const S3_PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT ?? MEDIA_BASE_URL;

export const getS3FileUrl = (key: string) => `${MEDIA_BASE_URL}/${S3_BUCKET}/${key}`;

/**
 * Rewrite a browser-facing media URL (MEDIA_BASE_URL-based) to the
 * server-reachable MinIO endpoint. Inside docker compose the public host
 * (e.g. localhost:9000) does not resolve to MinIO from the server container,
 * so server-side downloads must go through S3_ENDPOINT instead.
 * Non-media URLs are returned unchanged.
 */
export const toInternalMediaUrl = (url: string): string => {
  if (S3_ENDPOINT === MEDIA_BASE_URL || !url.startsWith(`${MEDIA_BASE_URL}/`)) {
    return url;
  }
  return `${S3_ENDPOINT}/${url.slice(MEDIA_BASE_URL.length + 1)}`;
};
