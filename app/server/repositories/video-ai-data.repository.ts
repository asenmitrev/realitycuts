import { VideoAIData } from '../models/video-ai-data';
import type { ITranscriptionJob, IVideoAIData, IVideoAIDataWithTranscriptionJob } from '../types';
import { TranscriptionJob } from '../models/transcription-job';

export class VideoAIDataRepository {
  /**
   * Find video by ID
   */
  async findById<T extends boolean>(
    id: string,
    populateTranscriptionJob: T = true as T
  ): Promise<T extends true ? IVideoAIDataWithTranscriptionJob | null : IVideoAIData | null> {
    const query = VideoAIData.findById(id);
    if (populateTranscriptionJob === true) {
      query.populate<{
        transcriptionJob: ITranscriptionJob;
      }>('transcriptionJob');
    }
    return (await query.exec()) as T extends true ? IVideoAIDataWithTranscriptionJob | null : IVideoAIData | null;
  }

  async findByTranscriptionJobId(transcriptionJobId: string): Promise<IVideoAIData | null> {
    return await VideoAIData.findOne({ transcriptionJob: transcriptionJobId });
  }

  /**
   * Find videos by user ID with pagination.
   * Filters out in-progress chat-generated videos (VideoAIData exists but has no source and no voiceOver).
   */
  async findVideosWithPagination(userId: string, skip: number = 0, limit: number = 1000) {
    const [result] = await TranscriptionJob.aggregate([
      {
        $match: {
          userId,
          isDeleted: { $ne: true },
          status: { $in: ['VIDEO_RECEIVED', 'TRANSCRIBED', 'COMPLETED', 'FAILED', 'INSUFFICIENT_FOOTAGE'] }
        }
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          videos: [
            { $sort: { _id: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'videoaidata2',
                localField: '_id',
                foreignField: 'transcriptionJob',
                as: 'videoAIData',
                pipeline: [
                  {
                    $project: {
                      'source.metadata': 1,
                      'source.thumbnail': 1,
                      title: 1,
                      'segments.alternatives.thumbnailUrl': 1,
                      'segments.timeEnd': 1,
                      formattedTranscript: 1,
                      transcriptionJob: 1
                    }
                  }
                ]
              }
            },
            {
              $lookup: {
                from: 'exportjobs',
                let: { videoDataId: { $arrayElemAt: ['$videoAIData._id', 0] } },
                pipeline: [
                  { $match: { $expr: { $eq: ['$videoDataId', '$$videoDataId'] } } },
                  { $sort: { _id: -1 } },
                  { $limit: 1 }
                ],
                as: 'exportJobs'
              }
            }
          ]
        }
      }
    ]);

    return {
      videos: result?.videos ?? [],
      total: result?.total[0]?.count ?? 0
    };
  }

  /**
   * Get count of videos for a user
   */
  async getVideoCount(userId: string): Promise<number> {
    return await TranscriptionJob.countDocuments({
      userId,
      isDeleted: { $ne: true },
      status: { $in: ['VIDEO_RECEIVED', 'TRANSCRIBED', 'COMPLETED', 'FAILED'] }
    });
  }

  /**
   * Get video statistics by user
   */
  async getVideoStatsByUser(days: number = 25): Promise<Array<{ _id: string; count: number }>> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await TranscriptionJob.aggregate([
      {
        $match: {
          createdAt: {
            $gte: cutoffDate
          },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
  }

  /**
   * Find ALL videos across all users with pagination (for secret admin page)
   * ONLY TO BE USED IN UAT ENVIRONMENT
   */
  async findAllVideosWithPagination(skip: number = 0, limit: number = 50) {
    const matchConditions: any = {
      isDeleted: { $ne: true },
      status: { $in: ['VIDEO_RECEIVED', 'TRANSCRIBED', 'COMPLETED', 'FAILED'] }
    };

    const totalCount = await TranscriptionJob.countDocuments(matchConditions);

    const allVideos = await TranscriptionJob.aggregate([
      {
        $match: matchConditions
      },
      {
        $lookup: {
          from: 'videoaidata2',
          localField: '_id',
          foreignField: 'transcriptionJob',
          as: 'videoAIData'
        }
      },
      {
        $lookup: {
          from: 'exportjobs',
          localField: 'videoAIData._id',
          foreignField: 'videoDataId',
          as: 'exportJobs'
        }
      },
      {
        $sort: {
          createdAt: -1
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]);

    return { videos: allVideos, total: totalCount };
  }

  /**
   * Update a video
   */
  async update(id: string, data: Partial<any>): Promise<any> {
    return await VideoAIData.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  /**
   * Delete a video
   */
  async delete(id: string): Promise<any> {
    return await VideoAIData.findByIdAndDelete(id);
  }

  /**
   * Create a new VideoAIData document
   */
  async create(videoData: Partial<IVideoAIData>): Promise<IVideoAIData> {
    return await VideoAIData.create(videoData);
  }

  /**
   * Clone a VideoAIData object for a new user
   */
  async cloneForUser(sourceVideoId: string, newUserId: string) {
    // Fetch the source video with populated transcription job
    const sourceVideo = await this.findById(sourceVideoId, true);
    if (!sourceVideo) throw new Error('Source video not found');
    if (!sourceVideo.transcriptionJob) throw new Error('Source video missing transcription job');

    // Create a new transcription job for the new user
    const { TranscriptionJob } = require('../models/transcription-job');
    const newTranscriptionJob = await TranscriptionJob.create({
      userId: newUserId,
      videoUrl: sourceVideo.transcriptionJob.videoUrl,
      thumbnailUrl: sourceVideo.transcriptionJob.thumbnailUrl,
      audioUrl: sourceVideo.transcriptionJob.audioUrl,
      title: sourceVideo.transcriptionJob.title,
      batchName: sourceVideo.transcriptionJob.batchName,
      filename: sourceVideo.transcriptionJob.filename,
      guidance: sourceVideo.transcriptionJob.guidance,
      includeMusic: sourceVideo.transcriptionJob.includeMusic,
      metadata: sourceVideo.transcriptionJob.metadata,
      deepgramResults: sourceVideo.transcriptionJob.deepgramResults,
      isDeleted: false,

      pinecone: sourceVideo.transcriptionJob.pinecone,
      brollDuration: sourceVideo.transcriptionJob.brollDuration,
      transcript: sourceVideo.transcriptionJob.transcript,
      jobType: sourceVideo.transcriptionJob.jobType,
      status: 'VIDEO_RECEIVED'
    });

    // Prepare the new video data
    const { VideoAIData } = require('../models/video-ai-data');
    // Use toObject if available (Mongoose doc), otherwise fallback to plain object
    const base =
      typeof sourceVideo === 'object' && typeof (sourceVideo as any).toObject === 'function'
        ? (sourceVideo as any).toObject()
        : { ...sourceVideo };
    const newVideoData = await VideoAIData.create({
      ...base,
      _id: undefined,
      userId: newUserId,
      transcriptionJob: newTranscriptionJob._id,
      createdAt: undefined,
      updatedAt: undefined
    });
    return newVideoData;
  }
}

export default new VideoAIDataRepository();
