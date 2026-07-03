import { TranscriptionJob } from '../models/transcription-job';
import { ITranscriptionJob } from '../types';
import { FilterQuery } from 'mongoose';

export class TranscriptionJobRepository {
  /**
   * Find transcription job by ID
   */
  async findById(id: string): Promise<ITranscriptionJob | null> {
    return await TranscriptionJob.findById(id);
  }

  /**
   * Find transcription jobs by user ID
   */
  async findJobs(userId: string): Promise<ITranscriptionJob[]> {
    return await TranscriptionJob.find({
      userId,
      status: { $ne: 'COMPLETED' },
      isDeleted: { $ne: true }
    }).sort({ updatedAt: -1 });
  }

  /**
   * Update transcription job
   */
  async update(id: string, data: Partial<ITranscriptionJob>): Promise<ITranscriptionJob | null> {
    return await TranscriptionJob.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  /**
   * Save transcription job
   */
  async save(transcriptionJob: ITranscriptionJob): Promise<void> {
    await TranscriptionJob.updateOne({ _id: transcriptionJob._id }, transcriptionJob, { upsert: true });
  }

  /**
   * Delete transcription job
   */
  async delete(id: string): Promise<void> {
    await TranscriptionJob.findByIdAndDelete(id);
  }

  async create(transcriptionJob: Partial<ITranscriptionJob>): Promise<ITranscriptionJob> {
    return await TranscriptionJob.create(transcriptionJob);
  }
}

export default new TranscriptionJobRepository();
