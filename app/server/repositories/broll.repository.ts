import { BrollFootageMetadata } from '../models/broll-video-metadata';
import { IBrollFootageMetadata } from '../types';
import { getObjectId } from '../utils/mongoose-utils';

function embeddedForClusteringFilter(libraryId: string) {
  return {
    libraryId,
    isDeleted: { $ne: true },
    videoEmbedding: { $exists: true, $not: { $size: 0 } }
  };
}

export class BrollRepository {
  /**
   * Find broll footage with a video embedding for a library, for clustering.
   * `videoEmbedding` is `select: false` on the schema, so it must be requested explicitly.
   */
  async findEmbeddingsForClustering(
    libraryId: string
  ): Promise<Pick<IBrollFootageMetadata, '_id' | 'title' | 'videoEmbedding'>[]> {
    return await BrollFootageMetadata.find(embeddedForClusteringFilter(libraryId), {
      title: 1,
      videoEmbedding: 1
    }).lean();
  }

  /**
   * Cheap count-only version of `findEmbeddingsForClustering`, for pre-checking
   * whether a library has enough embedded broll to bother clustering.
   */
  async countEmbeddingsForClustering(libraryId: string): Promise<number> {
    return await BrollFootageMetadata.countDocuments(embeddedForClusteringFilter(libraryId));
  }

  /**
   * Bulk-assign cluster IDs produced by a clustering run. Chunked so a huge
   * library doesn't push one giant bulkWrite payload through the driver.
   */
  async bulkSetClusterAssignments(
    assignments: { id: string; clusterId: number | null }[],
    clusterVersion: number
  ): Promise<void> {
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < assignments.length; i += CHUNK_SIZE) {
      await this.bulkSetClusterAssignmentsChunk(assignments.slice(i, i + CHUNK_SIZE), clusterVersion);
    }
  }

  private async bulkSetClusterAssignmentsChunk(
    assignments: { id: string; clusterId: number | null }[],
    clusterVersion: number
  ): Promise<void> {
    if (assignments.length === 0) return;

    await BrollFootageMetadata.bulkWrite(
      assignments.map(({ id, clusterId }) => ({
        updateOne: {
          filter: { _id: getObjectId(id) },
          update: { $set: { clusterId, clusterVersion } }
        }
      }))
    );
  }

  /**
   * Find broll footage by ID
   */
  async findById(id: string): Promise<IBrollFootageMetadata | null> {
    return await BrollFootageMetadata.findById(id);
  }

  /**
   * Get broll by library ID with pagination
   */
  async findByLibraryId(
    libraryId: string,
    skip: number = 0,
    limit: number = 10
  ): Promise<{ broll: IBrollFootageMetadata[]; total: number }> {
    const [broll, total] = await Promise.all([
      BrollFootageMetadata.find({ libraryId, isDeleted: { $ne: true } })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      BrollFootageMetadata.countDocuments({ libraryId, isDeleted: { $ne: true } })
    ]);

    return { broll, total };
  }

  async findByIds(ids: string[]): Promise<IBrollFootageMetadata[]> {
    return await BrollFootageMetadata.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
  }

  async create(data: Partial<IBrollFootageMetadata>): Promise<IBrollFootageMetadata> {
    return await BrollFootageMetadata.create(data);
  }

  /**
   * Count broll footage by library ID
   */
  async countByLibraryId(libraryId: string): Promise<number> {
    return await BrollFootageMetadata.countDocuments({ libraryId, isDeleted: { $ne: true } });
  }

  /**
   * Update broll footage by ID
   */
  async update(id: string, data: Partial<IBrollFootageMetadata>): Promise<IBrollFootageMetadata | null> {
    return await BrollFootageMetadata.findByIdAndUpdate(id, data, { new: true });
  }

  /**
   * Update broll footage by library ID
   */
  async updateByLibraryId(libraryId: string, data: Partial<IBrollFootageMetadata>): Promise<void> {
    await BrollFootageMetadata.updateMany({ libraryId }, data);
  }

  /**
   * Mark broll as deleted
   */
  async markAsDeleted(id: string): Promise<IBrollFootageMetadata | null> {
    return await BrollFootageMetadata.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
  }

  /**
   * Find broll footage by original YouTube URL
   */
  async findByYoutubeUrl(libraryId: string, youtubeUrl: string): Promise<IBrollFootageMetadata[]> {
    return await BrollFootageMetadata.find({
      libraryId,
      originalYoutubeUrl: youtubeUrl,
      isDeleted: { $ne: true }
    });
  }

  /**
   * Get broll by library ID filtered by arollBrollHeuristic with pagination
   */
  async findByLibraryIdAndHeuristic(
    libraryId: string,
    arollBrollHeuristic: 'AROLL' | 'BROLL',
    skip: number = 0,
    limit: number = 10
  ): Promise<{ broll: IBrollFootageMetadata[]; total: number }> {
    const filter: any = {
      libraryId,
      isDeleted: { $ne: true },
      arollBrollHeuristic
    };

    const [broll, total] = await Promise.all([
      BrollFootageMetadata.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      BrollFootageMetadata.countDocuments(filter)
    ]);

    return { broll, total };
  }

  /**
   * Get broll by library ID filtered by combined A-roll criteria with pagination
   * Combines four sources:
   * 1. LLM classification: arollBroll === 'AROLL'
   * 2. Heuristic classification: arollBrollHeuristic === 'AROLL'
   * 3. Background motion: backgroundMotionScore <= 10
   * 4. Face motion: maxMouthMovementScore >= 10 OR no faces (mouthMovementScores.length === 0)
   *
   * Note: This query is vector-search compatible. All fields used in the filter must be
   * included as filter fields in the MongoDB Atlas vector search index.
   */
  async findByLibraryIdAndArollCombined(
    libraryId: string,
    skip: number = 0,
    limit: number = 10
  ): Promise<{ broll: IBrollFootageMetadata[]; total: number }> {
    const filter: any = {
      libraryId,
      isDeleted: { $ne: true },
      $and: [
        { arollBroll: 'AROLL' },
        { arollBrollHeuristic: 'AROLL' },
        { backgroundMotionScore: { $lte: 10 } },
        {
          $or: [
            { mouthMovementScores: { $exists: false } },
            { mouthMovementScores: null },
            {
              mouthMovementScores: { $gt: 10 }
            }
          ]
        }
      ]
    };

    const [broll, total] = await Promise.all([
      BrollFootageMetadata.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      BrollFootageMetadata.countDocuments(filter)
    ]);

    return { broll, total };
  }

  /**
   * Get broll by library ID filtered by combined B-roll criteria with pagination
   * Combines four sources:
   * 1. LLM classification: arollBroll === 'BROLL'
   * 2. Heuristic classification: arollBrollHeuristic === 'BROLL'
   * 3. Background motion: backgroundMotionScore > 10
   * 4. Face motion: max(mouthMovementScores) >= 25 OR no faces OR mouthMovementScores doesn't exist
   */
  async findByLibraryIdAndBrollCombined(
    libraryId: string,
    skip: number = 0,
    limit: number = 10
  ): Promise<{ broll: IBrollFootageMetadata[]; total: number }> {
    const filter: any = {
      libraryId,
      isDeleted: { $ne: true },
      $and: [
        {
          $or: [
            {
              $and: [{ arollBroll: 'BROLL' }, { arollBrollHeuristic: 'BROLL' }]
            },
            { backgroundMotionScore: { $gt: 10 } },
            {
              $and: [
                { mouthMovementScores: { $exists: true } },
                { mouthMovementScores: { $ne: null } },
                { $expr: { $lte: [{ $max: '$mouthMovementScores' }, 10] } }
              ]
            },
            { mouthMovementScores: { $exists: false } },
            { 'faceDetectionResults.frame05s.faceCount': 0 },
            { 'faceDetectionResults.frame25s.faceCount': 0 }
          ]
        },
        {
          $or: [{ arollBroll: 'BROLL' }, { arollBrollHeuristic: 'BROLL' }]
        }
      ]
    };

    const [broll, total] = await Promise.all([
      BrollFootageMetadata.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      BrollFootageMetadata.countDocuments(filter)
    ]);

    return { broll, total };
  }

  /**
   * Get broll by library ID that doesn't match A-roll or B-roll combined criteria (unknown/unclassified)
   * Returns footage that doesn't match either findByLibraryIdAndArollCombined or findByLibraryIdAndBrollCombined
   */
  async findByLibraryIdAndUnknown(
    libraryId: string,
    skip: number = 0,
    limit: number = 10
  ): Promise<{ broll: IBrollFootageMetadata[]; total: number }> {
    // A-roll combined filter
    const arollFilter: any = {
      $and: [
        { arollBroll: 'AROLL' },
        { arollBrollHeuristic: 'AROLL' },
        { backgroundMotionScore: { $lte: 10 } },
        {
          $or: [
            { mouthMovementScores: { $exists: false } },
            { mouthMovementScores: null },
            {
              mouthMovementScores: { $gt: 10 }
            }
          ]
        }
      ]
    };

    // B-roll combined filter
    const brollFilter: any = {
      $and: [
        {
          $or: [
            {
              $and: [{ arollBroll: 'BROLL' }, { arollBrollHeuristic: 'BROLL' }]
            },
            { backgroundMotionScore: { $gt: 10 } },
            {
              $and: [
                { mouthMovementScores: { $exists: true } },
                { mouthMovementScores: { $ne: null } },
                { $expr: { $lte: [{ $max: '$mouthMovementScores' }, 10] } }
              ]
            },
            { mouthMovementScores: { $exists: false } },
            { 'faceDetectionResults.frame05s.faceCount': 0 },
            { 'faceDetectionResults.frame25s.faceCount': 0 }
          ]
        },
        {
          $or: [{ arollBroll: 'BROLL' }, { arollBrollHeuristic: 'BROLL' }]
        }
      ]
    };

    const filter: any = {
      libraryId,
      isDeleted: { $ne: true },
      $nor: [arollFilter, brollFilter]
    };

    const [broll, total] = await Promise.all([
      BrollFootageMetadata.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      BrollFootageMetadata.countDocuments(filter)
    ]);

    return { broll, total };
  }
}

export default new BrollRepository();
