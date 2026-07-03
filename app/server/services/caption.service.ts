import { CaptionSettings } from '../types';
import captionRepository from '../repositories/caption.repository';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../errors';

export class CaptionService {
  /**
   * Create a new caption
   */
  async createCaption(captionData: CaptionSettings): Promise<CaptionSettings> {
    return await captionRepository.create(captionData);
  }

  /**
   * Get a caption by ID
   * @throws {NotFoundError} If caption is not found
   */
  async getCaptionById(id: string): Promise<CaptionSettings> {
    if (!id) {
      throw new BadRequestError('Caption id is mandatory.');
    }

    const caption = await captionRepository.findById(id);

    if (!caption) {
      throw new NotFoundError('Caption not found.');
    }

    return caption;
  }

  /**
   * Update a caption
   * @throws {NotFoundError} If caption is not found
   */
  async updateCaption(id: string, captionData: CaptionSettings): Promise<CaptionSettings> {
    if (!id) {
      throw new BadRequestError('Caption id is mandatory.');
    }

    const updatedCaption = await captionRepository.update(id, captionData);

    if (!updatedCaption) {
      throw new NotFoundError('Caption not found.');
    }

    return updatedCaption;
  }

  /**
   * Get all captions for a user
   */
  async getCaptionsForUser(userId: string): Promise<CaptionSettings[]> {
    return await captionRepository.findByUserId(userId);
  }

  /**
   * Delete a caption
   * @throws {NotFoundError} If caption is not found
   * @throws {UnauthorizedError} If user doesn't own the caption
   */
  async deleteCaption(id: string, userId: string): Promise<void> {
    if (!id) {
      throw new BadRequestError('Caption id is mandatory.');
    }

    const caption = await captionRepository.findById(id);

    if (!caption) {
      throw new NotFoundError('Caption not found.');
    }

    // Ensure user owns the caption
    if (caption.userId !== userId) {
      throw new UnauthorizedError('Unauthorized to delete this caption.');
    }

    const deleted = await captionRepository.deleteById(id);

    if (!deleted) {
      throw new Error('Failed to delete caption.');
    }
  }
}

export default new CaptionService();
