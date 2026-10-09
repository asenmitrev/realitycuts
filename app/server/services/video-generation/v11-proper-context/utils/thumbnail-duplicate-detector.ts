import { Alternative } from 'server/types/video-ai-data';
import { logger } from 'server/services/logging';
import { toInternalMediaUrl } from 'server/config/storage';
export class ThumbnailDuplicateDetector {
  public static async getPerceptualHash(thumbnailUrl: string): Promise<string> {
    try {
      const response = await fetch(toInternalMediaUrl(thumbnailUrl));
      if (!response.ok) {
        throw new Error(`Failed to fetch thumbnail: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      let hash = '';
      const sampleSize = Math.min(64, uint8Array.length);
      const step = Math.floor(uint8Array.length / sampleSize);

      for (let i = 0; i < sampleSize; i++) {
        const index = i * step;
        const byte = uint8Array[index] || 0;
        // Convert to binary and take significant bits
        hash += byte > 128 ? '1' : '0';
      }

      return hash;
    } catch (error) {
      logger.error(`Error generating perceptual hash for ${thumbnailUrl}:`, error);
      return '';
    }
  }

  /**
   * Calculate Hamming distance between two binary strings
   */
  private static hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      return Math.max(hash1.length, hash2.length);
    }

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    return distance;
  }

  /**
   * Check if two thumbnails are similar based on perceptual hash
   */
  private static areSimilar(hash1: string, hash2: string, threshold: number = 5): boolean {
    const distance = this.hammingDistance(hash1, hash2);
    return distance <= threshold;
  }

  /**
   * Fill in `perceptualHash` for every alternative that has a thumbnail but no hash yet.
   * Thumbnails are fetched concurrently; failed fetches leave the hash unset.
   */
  static async ensureHashes(alternatives: Alternative[]): Promise<void> {
    await Promise.all(
      alternatives.map(async alternative => {
        if (!alternative.thumbnailUrl || alternative.perceptualHash) {
          return;
        }
        const hash = await this.getPerceptualHash(alternative.thumbnailUrl);
        if (hash) {
          alternative.perceptualHash = hash;
        }
      })
    );
  }

  /**
   * Drop alternatives whose thumbnail hash is missing or similar to any previously used one.
   * Synchronous: call `ensureHashes` on both lists first.
   */
  static filterUnique(prevAlternatives: Alternative[], alternatives: Alternative[]): Alternative[] {
    const oldHashes = prevAlternatives
      .filter(alternative => alternative.thumbnailUrl && alternative.perceptualHash)
      .map(alternative => alternative.perceptualHash!);

    return alternatives.filter(alternative => {
      const hash = alternative.thumbnailUrl ? alternative.perceptualHash : undefined;
      return Boolean(hash) && !oldHashes.some(oldHash => this.areSimilar(oldHash, hash!));
    });
  }
}
