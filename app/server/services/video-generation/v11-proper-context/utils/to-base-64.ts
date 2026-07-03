import { toInternalMediaUrl } from 'server/config/storage';

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export async function imageUrlToBase64(url?: string): Promise<string> {
  if (!url) return '';

  const response = await fetch(toInternalMediaUrl(url));
  if (!response.ok) {
    throw new Error(`Failed to fetch image. status=${response.status}`);
  }

  const contentTypeHeader = response.headers.get('content-type') ?? '';
  const contentType = contentTypeHeader.split(';')[0]?.trim().toLowerCase();
  if (!contentType || !SUPPORTED_IMAGE_TYPES.has(contentType)) {
    throw new Error(`Unsupported content-type: ${contentTypeHeader || '(missing)'}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
}
