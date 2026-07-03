import { Response } from 'express';
import { ObjectId } from 'mongoose';
import transcriptionJobRepository from '../repositories/transcription-job.repository';
import { UserProfile } from '../models/user-profile';
import { deleteFromS3 } from '../services/storage/s3';
import { safelyDelete } from '../services/fs';
import { logger } from '../services/logging';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../errors';
import { ITranscriptionJob } from '../types';

export class TranscriptionJobService {
  /**
   * Get all in-progress transcription jobs for a user
   */
  async getJobs(userId: string, clientId?: string | ObjectId): Promise<ITranscriptionJob[]> {
    const userProfile = await UserProfile.findOne({ firebaseId: userId });

    if (!userProfile) {
      throw new NotFoundError('User profile not found.');
    }

    return await transcriptionJobRepository.findJobs(userId);
  }

  /**
   * Update a transcription job
   */
  async updateJob(id: string, userId: string, data: Partial<ITranscriptionJob>): Promise<ITranscriptionJob> {
    const job = await transcriptionJobRepository.findById(id);

    if (!job) {
      throw new NotFoundError('Transcription job not found.');
    }

    if (job.userId !== userId) {
      throw new UnauthorizedError('Not authorized to update this transcription job.');
    }

    // Update the job with new data
    Object.assign(job, data);
    await transcriptionJobRepository.save(job);

    return job;
  }

  /**
   * Delete a transcription job and associated resources
   */
  async deleteJob(id: string, userId: string): Promise<void> {
    if (!id) {
      throw new BadRequestError('Transcription job id is mandatory.');
    }

    const result = await transcriptionJobRepository.update(id, {
      isDeleted: true
    });

    if (!result) {
      throw new NotFoundError('Transcription job not found or not owned by user.');
    }

    // Clean up associated files
    await this.cleanupJobResources(result);
  }

  /**
   * Clean up resources associated with a transcription job
   */
  private async cleanupJobResources(job: ITranscriptionJob): Promise<void> {
    if (job.filename) {
      const videoPath = `/tmp/data/${job.filename}`;
      safelyDelete(videoPath);
    }

    if (job.videoUrl) {
      const urlParts = job.videoUrl.split('/').reverse();
      const videoName = urlParts[0];
      deleteFromS3(videoName, err => {
        if (err) {
          logger.error('Error deleting source from cloud', {
            Error: err,
            'Video Name': videoName,
            'User ID': job.userId
          });
        }
      });
    }

    if (job.thumbnailUrl) {
      const urlParts = job.thumbnailUrl.split('/').reverse();
      const thumbnailName = urlParts[0];
      const thumbnailPath = `/tmp/data/${thumbnailName}`;
      safelyDelete(thumbnailPath);

      deleteFromS3(thumbnailName, err => {
        if (err) {
          logger.error('Error deleting thumbnail from cloud', {
            Error: err,
            'Thumbnail Name': thumbnailName,
            'User ID': job.userId
          });
        }
      });
    }

    if (job.audioUrl) {
      const urlParts = job.audioUrl.split('/').reverse();
      const audioName = urlParts[0];
      const audioPath = `/tmp/data/${audioName}`;
      safelyDelete(audioPath);

      deleteFromS3(audioName, err => {
        if (err) {
          logger.error('Error deleting audio from cloud', {
            Error: err,
            'Audio Name': audioName,
            'User ID': job.userId
          });
        }
      });
    }
  }
}

export default new TranscriptionJobService();
