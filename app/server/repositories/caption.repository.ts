import { Caption } from '../models/caption';
import { CaptionSettings } from '../types';

export class CaptionRepository {
  /**
   * Create a new caption
   */
  async create(captionData: CaptionSettings): Promise<CaptionSettings> {
    const caption = new Caption(captionData);
    return await caption.save();
  }

  /**
   * Find a caption by ID
   */
  async findById(id: string): Promise<CaptionSettings | null> {
    return await Caption.findById(id);
  }

  /**
   * Find all captions by user ID
   */
  async findByUserId(userId: string): Promise<CaptionSettings[]> {
    return await Caption.find({ userId });
  }

  /**
   * Update a caption
   */
  async update(id: string, captionData: CaptionSettings): Promise<CaptionSettings | null> {
    const doc = await Caption.findById(id);

    if (!doc) {
      return null;
    }

    doc.overwrite(captionData);
    return await doc.save();
  }

  /**
   * Delete a caption by ID
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await Caption.findByIdAndDelete(id);
    return !!result;
  }
}

export default new CaptionRepository();
