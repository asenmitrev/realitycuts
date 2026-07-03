import { Types } from 'mongoose';
import { Library } from '../models/library';
import { LibraryUpload } from '../models/library-upload';
import { BrollFootageMetadata } from '../models/broll-video-metadata';
import { ILibrary, ILibraryUpload, IBrollFootageMetadata, IPopulatedLibrary } from '../types';

export class LibraryRepository {
  /**
   * Find a library by ID
   */
  async findById<PopulateFields extends boolean>(
    id: string,
    populateFields: PopulateFields = false as PopulateFields
  ): Promise<PopulateFields extends true ? IPopulatedLibrary : ILibrary | null> {
    const query = Library.findById(id);
    if (populateFields) {
      query.populate<{ processedFiles: { link: ILibraryUpload } }>('processedFiles.link');
    }
    return (await query.exec()) as PopulateFields extends true ? IPopulatedLibrary : ILibrary | null;
  }

  /**
   * Find a library by ID and user ID
   */
  async findByIdAndUserId(id: string, userId: string, populateFields: boolean = false): Promise<ILibrary | null> {
    const query = Library.findOne({ _id: id, userId });
    if (populateFields) {
      query.populate<{ processedFiles: { link: ILibraryUpload } }>('processedFiles.link');
    }
    return await query.exec();
  }

  /**
   * Find all libraries by user ID excluding NEW and DELETED status
   */
  async findAllByUserId(userId: string): Promise<ILibrary[]> {
    return await Library.find({ userId, status: { $nin: ['NEW', 'DELETED'] } }).select('title status isPublic totalProgress').lean();
  }

  /**
   * Find a library with NEW status by user ID
   */
  async findNewByUserId(userId: string): Promise<ILibrary | null> {
    return await Library.findOne({ userId, status: 'NEW' }).populate('processedFiles.link');
  }

  /**
   * Get count of libraries for a user (excluding NEW status)
   */
  async getNonNewLibraryCount(userId: string): Promise<number> {
    return await Library.countDocuments({
      userId,
      status: { $ne: 'NEW' }
    });
  }

  /**
   * Find public libraries not owned by the user
   */
  async findPublicLibraries(
    userId: string,
    skip: number = 0,
    limit: number = 100,
    search?: string
  ): Promise<ILibrary[]> {
    const searchQuery: any = {
      userId: { $ne: userId },
      isPublic: true,
      status: { $nin: ['NEW', 'DELETED'] }
    };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchQuery.title = { $regex: escapedSearch, $options: 'i' };
    }

    return await Library.find(searchQuery).skip(skip).limit(limit);
  }

  /**
   * Count public libraries not owned by the user
   */
  async countPublicLibraries(userId: string, search?: string): Promise<number> {
    const searchQuery: any = {
      userId: { $ne: userId },
      isPublic: true,
      status: { $nin: ['NEW', 'DELETED'] }
    };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchQuery.title = { $regex: escapedSearch, $options: 'i' };
    }

    return await Library.countDocuments(searchQuery);
  }

  /**
   * Find public libraries by IDs
   */
  async findPublicLibrariesByIds(libraryIds: string[]): Promise<ILibrary[]> {
    return await Library.find({
      _id: { $in: libraryIds },
      isPublic: true,
      status: { $ne: 'NEW' }
    }).lean();
  }

  /**
   * Create a new library
   */
  async create(libraryData: Partial<ILibrary>): Promise<ILibrary> {
    const library = new Library(libraryData);
    return await library.save();
  }

  /**
   * Update a library
   */
  async update(id: string, data: Partial<ILibrary>): Promise<ILibrary | null> {
    return await Library.findByIdAndUpdate(id, data, { new: true });
  }

  /**
   * Add processed files to a library
   */
  async addProcessedFilesToLibrary(
    libraryId: string,
    uploadId: string,
    prompt: string = '',
    status: string = 'NEW'
  ): Promise<ILibrary | null> {
    return await Library.findByIdAndUpdate(
      libraryId,
      { $push: { processedFiles: { link: uploadId, prompt, status } } },
      { new: true }
    );
  }

  /**
   * Mark library as deleted
   */
  async markAsDeleted(id: string): Promise<ILibrary | null> {
    return await Library.findByIdAndUpdate(id, { status: 'DELETED' }, { new: true });
  }

  // LibraryUpload operations

  /**
   * Find a library upload by ID
   */
  async findUploadById(id: string): Promise<ILibraryUpload | null> {
    return await LibraryUpload.findById(id);
  }

  /**
   * Find library uploads by library ID
   */
  async findUploadsByLibraryId(libraryId: string): Promise<ILibraryUpload[]> {
    return await LibraryUpload.find({ libraryId });
  }

  /**
   * Create a new library upload
   */
  async createUpload(uploadData: Partial<ILibraryUpload>): Promise<ILibraryUpload> {
    const upload = new LibraryUpload(uploadData);
    return await upload.save();
  }

  /**
   * Update a library upload
   */
  async updateUpload(id: string, data: Partial<ILibraryUpload>): Promise<ILibraryUpload | null> {
    return await LibraryUpload.findByIdAndUpdate(id, data, { new: true });
  }

  /**
   * Delete a library upload
   */
  async deleteUpload(id: string): Promise<boolean> {
    const result = await LibraryUpload.findByIdAndDelete(id);
    return !!result;
  }

  // BrollFootageMetadata operations

  /**
   * Find broll footage by ID
   */
  async findBrollById(id: string): Promise<IBrollFootageMetadata | null> {
    return await BrollFootageMetadata.findById(id);
  }

  /**
   * Find broll footage by library ID with pagination
   */
  async findBrollByLibraryId(
    libraryId: string,
    skip: number = 0,
    limit: number = 10
  ): Promise<IBrollFootageMetadata[]> {
    return await BrollFootageMetadata.find({ libraryId, isDeleted: { $ne: true } })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  /**
   * Count broll footage by library ID
   */
  async countBrollByLibraryId(libraryId: string): Promise<number> {
    return await BrollFootageMetadata.countDocuments({ libraryId, isDeleted: { $ne: true } });
  }

  /**
   * Find libraries that haven't been clustered yet and have more than minBrollCount broll footage
   */
  async findLibrariesEligibleForClustering(minBrollCount: number = 100): Promise<Array<ILibrary>> {
    const libraries = await Library.aggregate([
      {
        $match: {
          status: { $in: ['PROCESSED'] }, // Only processed libraries
          $or: [
            { clusteringMetadata: { $exists: false } } // Never clustered
          ]
        }
      }
    ]);

    return libraries;
  }

  /**
   * Update broll footage by ID
   */
  async updateBroll(id: string, data: Partial<IBrollFootageMetadata>): Promise<IBrollFootageMetadata | null> {
    return await BrollFootageMetadata.findByIdAndUpdate(id, data, { new: true });
  }

  /**
   * Mark broll as deleted
   */
  async markBrollAsDeleted(id: string): Promise<IBrollFootageMetadata | null> {
    return await BrollFootageMetadata.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
  }

  /**
   * Mark multiple broll items as deleted
   */
  async markMultipleBrollAsDeleted(ids: string[]): Promise<void> {
    await BrollFootageMetadata.updateMany({ _id: { $in: ids } }, { $set: { isDeleted: true } });
  }

  /**
   * Find multiple broll items by their IDs
   */
  async findBrollByIds(ids: string[]): Promise<IBrollFootageMetadata[]> {
    return await BrollFootageMetadata.find({ _id: { $in: ids } }).lean();
  }

  /**
   * Update all broll isPublic status by library ID
   */
  async updateBrollIsPublicByLibraryId(libraryId: string, isPublic: boolean): Promise<void> {
    await BrollFootageMetadata.updateMany({ libraryId }, { $set: { isPublic } });
  }

  /**
   * Get screenshots from broll by library ID
   */
  async getBrollScreenshotsByLibraryId(libraryId: string, limit: number = 10): Promise<string[]> {
    const screenshots = await BrollFootageMetadata.find(
      { libraryId, isDeleted: { $ne: true }, thumbnailUrl: { $exists: true, $ne: null } },
      { thumbnailUrl: 1 }
    ).limit(limit);

    return screenshots.map(doc => doc.thumbnailUrl).filter(Boolean) as string[];
  }

  async findBrollByMetadataFilters(
    privateLibraryIds?: string[],
    metadataFilters?: {
      framing?: string;
      cameraAngle?: string;
      perspective?: string;
      depthOfField?: string;
      complexity?: string;
      arollBroll?: string;
      focusPosition?: string;
      clusterId?: string;
    },
    skip: number = 0,
    limit: number = 20
  ): Promise<IBrollFootageMetadata[]> {
    const filter: {
      isDeleted?: { $ne: boolean };
      libraryId?: { $in: Types.ObjectId[] };
      framing?: string;
      cameraAngle?: string;
      perspective?: string;
      depthOfField?: string;
      complexity?: string;
      arollBroll?: string;
      focusPosition?: string;
      clusterId?: number;
    } = { isDeleted: { $ne: true } };

    if (privateLibraryIds && privateLibraryIds.length > 0) {
      filter.libraryId = { $in: privateLibraryIds.map(id => new Types.ObjectId(id)) };
    }

    // Add metadata filters if provided
    if (metadataFilters) {
      if (metadataFilters.framing) filter.framing = metadataFilters.framing;
      if (metadataFilters.cameraAngle) filter.cameraAngle = metadataFilters.cameraAngle;
      if (metadataFilters.perspective) filter.perspective = metadataFilters.perspective;
      if (metadataFilters.depthOfField) filter.depthOfField = metadataFilters.depthOfField;
      if (metadataFilters.complexity) filter.complexity = metadataFilters.complexity;
      if (metadataFilters.arollBroll) filter.arollBroll = metadataFilters.arollBroll;
      if (metadataFilters.focusPosition) filter.focusPosition = metadataFilters.focusPosition;
      if (metadataFilters.clusterId) filter.clusterId = parseInt(metadataFilters.clusterId);
    }

    return await BrollFootageMetadata.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit);
  }

  /**
   * Count broll footage filtered by metadata criteria
   */
  async countBrollByMetadataFilters(
    privateLibraryIds?: string[],
    excludeIds?: string[],
    metadataFilters?: {
      framing?: string;
      cameraAngle?: string;
      perspective?: string;
      depthOfField?: string;
      complexity?: string;
      arollBroll?: string;
      focusPosition?: string;
      clusterId?: string;
    },
    isAllPublicLibrariesSelected: boolean = false
  ): Promise<number> {
    const filter: {
      $or?: { libraryId?: { $in: Types.ObjectId[] }; isPublic?: boolean }[];
      _id?: { $nin: Types.ObjectId[] };
      libraryId?: { $in: Types.ObjectId[] };
      arollBroll?: string;
      isDeleted?: { $ne: boolean };
      framing?: string;
      cameraAngle?: string;
      perspective?: string;
      depthOfField?: string;
      complexity?: string;
      focusPosition?: string;
      clusterId?: number;
    } = {
      isDeleted: { $ne: true }
    };

    if (privateLibraryIds && privateLibraryIds.length > 0) {
      filter.libraryId = { $in: privateLibraryIds.map(id => new Types.ObjectId(id)) };
    }

    if (isAllPublicLibrariesSelected) {
      filter.$or = [{ libraryId: filter.libraryId }, { isPublic: true }];
      delete filter.libraryId;
    }

    if (excludeIds && excludeIds.length > 0) {
      filter._id = { $nin: excludeIds.map(id => new Types.ObjectId(id)) };
    }

    // Add metadata filters if provided
    if (metadataFilters) {
      if (metadataFilters.framing) filter.framing = metadataFilters.framing;
      if (metadataFilters.cameraAngle) filter.cameraAngle = metadataFilters.cameraAngle;
      if (metadataFilters.perspective) filter.perspective = metadataFilters.perspective;
      if (metadataFilters.depthOfField) filter.depthOfField = metadataFilters.depthOfField;
      if (metadataFilters.complexity) filter.complexity = metadataFilters.complexity;
      if (metadataFilters.arollBroll) filter.arollBroll = metadataFilters.arollBroll;
      if (metadataFilters.focusPosition) filter.focusPosition = metadataFilters.focusPosition;
      if (metadataFilters.clusterId) (filter as any).clusterId = parseInt(metadataFilters.clusterId);
    }

    return await BrollFootageMetadata.countDocuments(filter);
  }

  /**
   * Get library statistics by user
   */
  async getLibraryStatsByUser(
    days: number = 25
  ): Promise<Array<{ _id: string; count: number }>> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await Library.aggregate([
      {
        $match: {
          createdAt: {
            $gte: cutoffDate
          },
          status: { $nin: ['NEW', 'DELETED'] }
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
   * Find ALL libraries across all users with pagination (for secret admin page)
   * ONLY TO BE USED IN UAT ENVIRONMENT
   */
  async findAllLibrariesWithPagination(skip: number = 0, limit: number = 50) {
    const matchConditions: any = {
      status: { $nin: ['NEW', 'DELETED'] }
    };

    const totalCount = await Library.countDocuments(matchConditions);

    const allLibraries = await Library.aggregate([
      {
        $match: matchConditions
      },
      {
        $lookup: {
          from: 'brollvideodata',
          localField: '_id',
          foreignField: 'libraryId',
          as: 'brollCount',
          pipeline: [
            {
              $match: {
                isDeleted: { $ne: true }
              }
            },
            {
              $count: 'count'
            }
          ]
        }
      },
      {
        $addFields: {
          brollVideoCount: {
            $ifNull: [{ $arrayElemAt: ['$brollCount.count', 0] }, 0]
          }
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

    return { libraries: allLibraries, total: totalCount };
  }
}

export default new LibraryRepository();
