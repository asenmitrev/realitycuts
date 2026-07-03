import { NotFoundError } from '../errors';
import brollRepository from '../repositories/broll.repository';
import { IBrollFootageMetadata } from '../types';
import { logger } from '../services/logging';

export class BrollService {
  /**
   * Get broll footage by ID
   */
  async getBrollById(brollId: string): Promise<IBrollFootageMetadata> {
    const broll = await brollRepository.findById(brollId);
    if (!broll) {
      throw new NotFoundError('Broll not found');
    }

    return broll;
  }

  /**
   * Get broll footage by library ID with pagination
   */
  async getBroll(
    libraryId: string,
    skip: number = 0,
    limit: number = 10
  ): Promise<{ broll: IBrollFootageMetadata[]; total: number }> {
    const result = await brollRepository.findByLibraryId(libraryId, skip, limit);
    return result;
  }
  // Add to BrollService class
  async updateBrollIsPublic(libraryId: string, isPublic: boolean): Promise<void> {
    await brollRepository.updateByLibraryId(libraryId, { isPublic });
  }
  /**
   * Get broll footage by library ID filtered by arollBrollHeuristic with pagination
   */
  async getBrollByHeuristic(
    libraryId: string,
    arollBrollHeuristic: 'AROLL' | 'BROLL',
    skip: number = 0,
    limit: number = 10
  ): Promise<{ broll: IBrollFootageMetadata[]; total: number }> {
    const result = await brollRepository.findByLibraryIdAndHeuristic(libraryId, arollBrollHeuristic, skip, limit);
    return result;
  }

  /**
   * Get broll footage by library ID filtered by combined A-roll criteria with pagination
   * Combines three sources: LLM classification, heuristic classification, and background motion score < 10
   */
  async getBrollByArollCombined(
    libraryId: string,
    skip: number = 0,
    limit: number = 10
  ): Promise<{ broll: IBrollFootageMetadata[]; total: number }> {
    const result = await brollRepository.findByLibraryIdAndArollCombined(libraryId, skip, limit);
    return result;
  }

  /**
   * Get broll footage by library ID filtered by combined B-roll criteria with pagination
   * Combines three sources: LLM classification, heuristic classification, and background motion score > 10
   */
  async getBrollByBrollCombined(
    libraryId: string,
    skip: number = 0,
    limit: number = 10
  ): Promise<{ broll: IBrollFootageMetadata[]; total: number }> {
    const result = await brollRepository.findByLibraryIdAndBrollCombined(libraryId, skip, limit);
    return result;
  }

  /**
   * Get broll footage by library ID that doesn't match A-roll or B-roll combined criteria (unknown/unclassified)
   */
  async getBrollByUnknown(
    libraryId: string,
    skip: number = 0,
    limit: number = 10
  ): Promise<{ broll: IBrollFootageMetadata[]; total: number }> {
    const result = await brollRepository.findByLibraryIdAndUnknown(libraryId, skip, limit);
    return result;
  }
}

export default new BrollService();
