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
   * Detect duplicate or very similar thumbnails in a list of alternatives
   */
  static async detectDuplicates(
    prevAlternatives: Alternative[],
    alternatives: Alternative[]
  ): Promise<{
    uniqueAlternatives: Alternative[];
  }> {
    const oldHashes = new Map<Alternative, string>();
    const newHashes = new Map<Alternative, string>();
    // Generate hashes for all alternatives
    logger.debug('🔍 Generating perceptual hashes for thumbnail duplicate detection...');

    for (const alternative of prevAlternatives) {
      if (alternative.thumbnailUrl) {
        if (alternative.perceptualHash) {
          oldHashes.set(alternative, alternative.perceptualHash);
        } else {
          const hash = await this.getPerceptualHash(alternative.thumbnailUrl);
          if (hash) {
            alternative.perceptualHash = hash;
            oldHashes.set(alternative, hash);
          }
        }
      }
    }

    for (const alternative of alternatives) {
      if (alternative.thumbnailUrl) {
        if (alternative.perceptualHash) {
          newHashes.set(alternative, alternative.perceptualHash);
        } else {
          const hash = await this.getPerceptualHash(alternative.thumbnailUrl);
          if (hash) {
            alternative.perceptualHash = hash;
            newHashes.set(alternative, hash);
          }
        }
      }
    }

    const uniqueAlternatives = alternatives.filter(alternative => {
      if (
        [...oldHashes.values()].some(altH => this.areSimilar(altH, newHashes.get(alternative) ?? '')) ||
        !newHashes.get(alternative)
      ) {
        return false;
      }
      return true;
    });

    return {
      uniqueAlternatives
    };
  }
}
