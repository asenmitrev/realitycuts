import libraryRepository from '../repositories/library.repository';
import { logger } from '../services/logging';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../errors';
import { ILibrary, IBrollFootageMetadata } from '../types';
import {
  deleteFromS3,
  deleteFromS3Promise,
  uploadToS3,
  generatePresignedUploadUrl,
  verifyS3Upload,
  setPublicReadAcl
} from '../services/storage/s3';
import {
  enqueueLibraryTaskBullMQ,
  enqueueLibraryItemClassificationTask,
  enqueueLibraryItemDeletionTask,
  enqueueLibraryItemThumbnailGenerationTask,
  enqueueLibraryItemVideoEmbeddingTask,
  enqueueLibraryItemHashGenerationTask
} from '../services/task-queue';
import { generateMetadataForVideo } from '../agents/metadata-generation.qwen.agent';
import { ILibraryUpload, LibraryTaskSettings, VideoCategorizationMetadata, IPopulatedLibrary } from 'shared/types';
import brollRepository from '../repositories/broll.repository';
import brollService from './broll.service';
import { BrollFootageMetadata } from '../models/broll-video-metadata';
import { LibraryTaskSettingsModel } from '../models/library-task-settings';
import { UserProfile } from '../models/user-profile';
import { sendMessage } from './sockets';
import userProfileRepository from '../repositories/user-profile.repository';
import { ENVIRONMENT } from '../config/const';
import { getS3FileUrl, S3_BUCKET } from '../config/storage';
import { getMetadata } from '../services/video-manipulation/ffmpeg';
import { LibraryUpload } from '../models/library-upload';
import { getObjectId } from '../utils/mongoose-utils';
import { similaritySearchV1 } from './vector-search.service';
import { ObjectId } from 'mongodb';

export class LibraryService {
  /**
   * Get all public library tags with video counts and screenshots
   * This corresponds to the getTags method in the controller
   */
  async getPublicLibraryTags(userId: string, skip: number = 0, limit: number = 100, search?: string) {
    // First, get the total count of public libraries
    const total = await libraryRepository.countPublicLibraries(userId, search);

    // Get the public libraries
    const publicLibraries = await libraryRepository.findPublicLibraries(userId, skip, limit, search);

    // Get video counts and screenshots for each library
    const libraryResults = await Promise.all(
      publicLibraries.map(async library => {
        // Count videos in this library
        const videoCount = await libraryRepository.countBrollByLibraryId(String(library._id));

        // Get screenshots
        const screenshots = await libraryRepository.getBrollScreenshotsByLibraryId(String(library._id), 10);
        return {
          libraryId: library._id,
          videoCount,
          tag: library.title,
          screenshots
        };
      })
    );

    // Filter out libraries with no videos
    return {
      tags: libraryResults,
      total
    };
  }

  /**
   * Create a new library
   */
  async createLibrary(libraryData: Partial<ILibrary>, userId: string): Promise<ILibrary> {
    // Set the user ID from auth context
    libraryData.userId = userId;

    // Create the library using the repository
    const libraryItem = await libraryRepository.create(libraryData);

    logger.info('Library item created', {
      'Library ID': String(libraryItem._id),
      'User ID': userId
    });

    return libraryItem;
  }

  /**
   * Delete a library and its associated data
   */
  async deleteLibrary(libraryId: string, userId: string): Promise<void> {
    logger.info('Deleting library', {
      'Library ID': libraryId,
      'User ID': userId
    });

    // Mark library as deleted
    await libraryRepository.markAsDeleted(libraryId);

    // Get all uploads for this library
    const uploads = await libraryRepository.findUploadsByLibraryId(libraryId);

    // Delete each upload from S3 and database
    for (const upload of uploads) {
      await deleteFromS3(upload.s3Key, () => { });
      if (upload._id) {
        await libraryRepository.deleteUpload(upload._id.toString());
      }
    }

    // Mark all broll footage as deleted
    await libraryRepository.updateBrollIsPublicByLibraryId(libraryId, false);

    // Get all broll footage for this library
    const brollFootages = await libraryRepository.findBrollByLibraryId(libraryId, 0, 10000);

    // Queue deletion tasks for each broll footage
    for (const broll of brollFootages) {
      try {
        await enqueueLibraryItemDeletionTask({
          userId,
          brollId: broll._id!.toString(),
          version: '1.0.0'
        });
      } catch (e) {
        logger.error('Error deleting broll metadata and pinecone', {
          Error: e,
          brollId: broll._id!.toString(),
          'User ID': userId
        });
      }
    }
  }

  /**
   * Delete a specific broll footage item
   */
  async deleteBroll(libraryId: string, brollId: string, userId: string): Promise<void> {
    // Verify that the library exists and belongs to the user
    const library = await libraryRepository.findById(libraryId);
    if (!library) {
      throw new NotFoundError('Library not found');
    }

    const userProfile = await userProfileRepository.findByFirebaseId(userId);

    if (library.userId !== userId && !userProfile?.isAdmin) {
      throw new NotFoundError('Library not found');
    }

    // Find the broll footage
    const broll = await libraryRepository.findBrollById(brollId);
    if (!broll) {
      throw new NotFoundError('Broll not found');
    }

    // Queue deletion task for this broll
    await enqueueLibraryItemDeletionTask({
      userId,
      brollId,
      version: '1.0.0'
    });

    // Mark the broll as deleted
    await libraryRepository.markBrollAsDeleted(brollId);

    logger.info('Broll marked as deleted', {
      'Library ID': libraryId,
      'Broll ID': brollId,
      'User ID': userId
    });
  }

  /**
   * Delete multiple broll footage items
   */
  async deleteBrollBulk(libraryId: string, brollIds: string[], userId: string): Promise<void> {
    // Verify that the library exists and belongs to the user
    const library = await libraryRepository.findById(libraryId);
    if (!library) {
      throw new NotFoundError('Library not found');
    }

    const userProfile = await userProfileRepository.findByFirebaseId(userId);

    if (library.userId !== userId && !userProfile?.isAdmin) {
      throw new NotFoundError('Library not found');
    }

    // Verify all broll items exist and belong to this library
    const brollItems = await libraryRepository.findBrollByIds(brollIds);
    const foundIds = brollItems.map((item: IBrollFootageMetadata) => item._id?.toString()).filter(Boolean) as string[];
    const invalidIds = brollIds.filter(id => !foundIds.includes(id));

    if (invalidIds.length > 0) {
      throw new NotFoundError(`Broll items not found: ${invalidIds.join(', ')}`);
    }

    // Verify all items belong to the specified library
    const invalidLibraryItems = brollItems.filter(
      (item: IBrollFootageMetadata) => item.libraryId?.toString() !== libraryId
    );
    if (invalidLibraryItems.length > 0) {
      throw new BadRequestError('Some broll items do not belong to the specified library');
    }

    // Queue deletion tasks for all broll items
    const deletionTasks = brollIds.map(brollId =>
      enqueueLibraryItemDeletionTask({
        userId,
        brollId,
        version: '1.0.0'
      })
    );

    await Promise.all(deletionTasks);

    // Mark all broll items as deleted
    await libraryRepository.markMultipleBrollAsDeleted(brollIds);

    logger.info('Multiple broll items marked as deleted', {
      'Library ID': libraryId,
      'Broll IDs': brollIds,
      Count: brollIds.length,
      'User ID': userId
    });
  }

  /**
   * Get metadata for a broll using its screenshots
   */
  async getBrollMetadata(brollId: string): Promise<VideoCategorizationMetadata> {
    // Find the broll footage
    const broll = await libraryRepository.findBrollById(brollId);
    if (!broll) {
      throw new NotFoundError('Broll not found');
    }

    // Check if broll has thumbnails
    if (!broll.thumbnailUrl || !broll.thumbnailUrl2) {
      throw new NotFoundError('Broll does not have screenshots');
    }

    // Generate metadata using the screenshots
    const metadata = await generateMetadataForVideo([broll.thumbnailUrl, broll.thumbnailUrl2]);

    logger.info('Generated broll metadata', {
      'Broll ID': brollId
    });

    return metadata;
  }

  /**
   * Generate video embeddings for a specific broll
   */
  async createBrollVideoEmbeddings(brollId: string, userId: string): Promise<void> {
    // Find the broll footage
    const broll = await libraryRepository.findBrollById(brollId);
    if (!broll) {
      throw new NotFoundError('Broll not found');
    }

    // Check if broll has URL
    if (!broll.url) {
      throw new NotFoundError('Broll does not have video URL');
    }

    // Queue video embedding task
    await enqueueLibraryItemVideoEmbeddingTask({
      brollId,
      userId,
      version: '1.0.0'
    });

    logger.info('Video embedding task queued for broll', {
      'Broll ID': brollId,
      'User ID': userId
    });
  }

  /**
   * Find similar videos using vector similarity search based on a broll item's vector
   */
  async findSimilarVideosByBrollId(
    brollId: string,
    libraryId: string,
    userId: string,
    limit: number = 20,
    privateLibraryIds?: string[]
  ) {
    // Find the broll footage and get its video embedding
    // Note: videoEmbedding has select: false in schema, so we need to explicitly include it
    const broll = await BrollFootageMetadata.findOne({ _id: new ObjectId(brollId) })
      .select('+videoEmbedding libraryId')
      .lean();

    if (!broll) {
      throw new NotFoundError('Broll not found');
    }

    if (!broll.videoEmbedding || broll.videoEmbedding.length === 0) {
      throw new BadRequestError('Broll does not have video embeddings. Please generate embeddings first.');
    }

    // Verify ownership
    const library = await libraryRepository.findById(libraryId);
    if (!library) {
      throw new NotFoundError('Library not found');
    }

    if (library.userId !== userId) {
      const userProfile = await userProfileRepository.findByFirebaseId(userId);
      if (!userProfile?.isAdmin) {
        throw new UnauthorizedError('You do not have permission to access this library');
      }
    }

    // Get the library IDs to search in (default to the current library)
    const searchLibraryIds = privateLibraryIds && privateLibraryIds.length > 0 ? privateLibraryIds : [libraryId];

    // Perform similarity search using the broll's vector
    const similarVideos = await similaritySearchV1(
      broll.videoEmbedding,
      limit,
      searchLibraryIds,
      [], // Exclude the original video
      undefined, // No metadata filters
      false // Not all public libraries
    );

    return similarVideos;
  }

  /**
   * Get a library by ID with optional user permissions check
   */
  async getLibraryById(
    libraryId: string,
    userId: string,
    checkUserPermission: boolean = false
  ): Promise<IPopulatedLibrary> {
    const library = await libraryRepository.findById(libraryId, true);

    if (!library) {
      throw new NotFoundError('Library not found');
    }

    return library;
  }
  /**
   * Get a library with NEW status or create one if it doesn't exist
   */
  async getOrCreateNewLibrary(userId: string): Promise<ILibrary> {
    // Try to find an existing NEW library using the repository
    let libraryItem = await libraryRepository.findNewByUserId(userId);

    // If no library exists with NEW status, create one
    if (!libraryItem) {
      libraryItem = await libraryRepository.create({
        userId,
        title: '',
        status: 'NEW'
      });
    }

    return libraryItem;
  }
  /**
   * Update a library by ID
   */
  async updateLibrary(id: string, data: { title: string; isPublic: boolean }, userId: string): Promise<ILibrary> {
    // First verify that the library exists and belongs to the user
    const library = await libraryRepository.findByIdAndUserId(id, userId);
    if (!library) {
      throw new NotFoundError('Library item not found.');
    }

    // Update the library
    const updatedLibrary = await libraryRepository.update(id, {
      title: data.title,
      isPublic: data.isPublic
    });

    if (!updatedLibrary) {
      throw new NotFoundError('Failed to update library');
    }

    // Update broll isPublic to match library's isPublic
    await brollService.updateBrollIsPublic(id, data.isPublic);

    logger.info('Library updated successfully', {
      'Library ID': id,
      'User ID': userId
    });

    return updatedLibrary;
  }
  /**
   * Get all libraries for a user
   */
  async getAllUserLibraries(userId: string): Promise<ILibrary[]> {
    // Get all library items using the repository
    return await libraryRepository.findAllByUserId(userId);
  }

  async processLibrary(
    libraryId: string,
    userId: string,
    uploadedFiles: { isNew: boolean; uploadId: string; description: string; link: string; prompt: string }[],
    isPublic: boolean,
    title: string,
  ): Promise<void> {
    const library = await libraryRepository.findById(libraryId, true);

    if (!library) {
      throw new NotFoundError('Library not found');
    }
    if (library.status === 'PROCESSING') {
      throw new NotFoundError(
        'This library is currently being processed. Once processing is complete, you can add more footage.'
      );
    }

    const userProfile = await userProfileRepository.findByFirebaseId(userId);

    if (!userProfile) {
      throw new NotFoundError('User profile not found');
    }

    // Calculate total duration of uploaded files
    const totalUploadedDuration = library.processedFiles
      .filter(file => file.status !== 'PROCESSED' && !!file.link)
      .reduce((acc: number, file: { link: ILibraryUpload }) => acc + file.link.duration, 0);

    if (totalUploadedDuration <= 0) {
      logger.info('Library processing failed: No videos to process', {
        'User ID': userId,
        'Library ID': libraryId
      });
      throw new BadRequestError('No videos to process.');
    }

    library.title = title;
    library.isPublic = isPublic;
    await BrollFootageMetadata.updateMany({ libraryId: library._id }, { $set: { isPublic: library.isPublic } });

    sendMessage(library.userId, library._id!.toString(), 'Starting video extraction.');

    // Prepare uploaded files data
    const uploadedFilesData = library.processedFiles
      .filter(file => file.status !== 'PROCESSED' && !!file.link)
      .map(file => ({
        uploadId: file.link._id!.toString(),
        duration: file.link.duration,
        link: file.link.url,
        progress: 0
      }));

    const videoChunks = groupFilesIntoChunks(uploadedFilesData);
    let asyncProgress = {};
    for (const chunk of videoChunks) {
      const settingsData: LibraryTaskSettings = {
        files: chunk.files
      };

      const settings = new LibraryTaskSettingsModel(settingsData);
      await settings.save();

      asyncProgress = {
        ...asyncProgress,
        ...Object.fromEntries(chunk.files.map(file => [file.fileId, 0])),
        emailSent: 0
      };

      const result = await enqueueLibraryTaskBullMQ(library._id!.toString(), settings._id.toString());

      logger.info('Library task enqueue result', {
        libraryId: library._id!.toString(),
        settingsId: settings._id.toString(),
        method: result.method
      });
    }

    await libraryRepository.update(library._id!.toString(), {
      status: 'QUEUED',
      title: title,
      isPublic: isPublic,
      progress: 0,
      asyncProgress
    });
  }

  /**
   * Reprocess a library and its associated broll footage
   */
  async reprocessLibrary(libraryId: string, prompt: string, userId: string): Promise<void> {
    // Verify that the library exists and belongs to the user
    const library = await libraryRepository.findByIdAndUserId(libraryId, userId);
    if (!library) {
      throw new NotFoundError('Library not found');
    }

    // Check if library can be reprocessed
    if (library.status !== 'PROCESSED' && library.status !== 'FAILED') {
      throw new BadRequestError('Library is not processed');
    }

    // Update library status to reprocessing
    await libraryRepository.update(libraryId, {
      status: 'REPROCESSING',
      processingStatus: 'REPROCESSING',
      progress: 0
    });

    // Get all broll footage for this library that is not deleted
    const brolls = await brollRepository.findByLibraryId(libraryId, 0, Number.MAX_SAFE_INTEGER);

    // Process brolls in chunks
    const chunkSize = 10;
    for (let i = 0; i < brolls.broll.length; i += chunkSize) {
      const brollChunk = brolls.broll.slice(i, i + chunkSize);
      await Promise.all(
        brollChunk.map(async broll => {
          const description: string = '';

          // Check if broll already has metadata
          const hasMetadata =
            broll.framing &&
            broll.cameraAngle &&
            broll.perspective &&
            broll.depthOfField &&
            broll.complexity &&
            broll.arollBroll;

          if (hasMetadata) {
            logger.info('Broll already has metadata, skipping', {
              'Broll ID': broll._id!
            });
            return;
          }

          // Queue appropriate task based on thumbnail availability
          if (!broll.thumbnailUrl2) {
            await enqueueLibraryItemThumbnailGenerationTask({
              userId,
              brollId: broll._id!,
              videoDescription: description,
              prompt,
              version: '1.0.0'
            });
          } else {
            await enqueueLibraryItemClassificationTask({
              brollId: broll._id!,
              userId,
              prompt,
              ytVideoDescription: description,
              version: '2.0.0'
            });
          }
        })
      );
    }

    // Update library status back to processed
    await libraryRepository.update(libraryId, {
      status: 'PROCESSED'
    });

    logger.info('Library reprocessing completed', {
      'Library ID': libraryId,
      'User ID': userId
    });
  }

  /**
   * Delete a library upload
   */
  async deleteUpload(libraryId: string, uploadId: string, userId: string): Promise<void> {
    logger.info('Deleting library upload', {
      'Library ID': libraryId,
      'Upload ID': uploadId,
      'User ID': userId
    });

    const library = await libraryRepository.findById(libraryId, false);
    if (!library) {
      throw new NotFoundError('Library not found');
    }

    const upload = await libraryRepository.findUploadById(uploadId);
    if (!upload) {
      throw new NotFoundError('Upload not found');
    }

    // Delete from S3
    await deleteFromS3Promise(upload.s3Key);

    // Remove upload from library's processedFiles
    library.processedFiles = library.processedFiles.filter(fileId => fileId.toString() !== uploadId);
    await libraryRepository.update(libraryId, { processedFiles: library.processedFiles });

    logger.info('Upload deleted from library', {
      'Library ID': libraryId,
      'Upload ID': uploadId,
      'User ID': userId
    });

    // Delete upload from database
    await libraryRepository.deleteUpload(uploadId);
  }

  /**
   * Create a new library upload
   */
  async createUpload(
    libraryId: string,
    userId: string,
    fileInfo: {
      path: string;
      filename: string;
      originalname: string;
      size: number;
      mimetype: string;
    }
  ): Promise<{
    uploadId: string;
    duration: number;
    name: string;
    url: string;
  }> {
    logger.info('Uploading library file', {
      'User ID': userId
    });

    // Check user profile and storage limits
    const userProfile = await UserProfile.findOne({ firebaseId: userId });
    if (!userProfile) {
      throw new NotFoundError('User profile not found');
    }

    // if ((await userProfile.getStorageGbRemaining()) <= 0 && !userProfile.isAdmin && ENVIRONMENT === 'prod') {
    //   throw new BadRequestError('You have no storage remaining in your subscription.');
    // }

    // Validate file info
    const { path, filename, originalname, size, mimetype } = fileInfo;

    if (!libraryId || !filename || !size || !mimetype) {
      throw new BadRequestError('Missing required parameters');
    }

    // Find the library
    const library = await libraryRepository.findById(libraryId);
    if (!library) {
      throw new NotFoundError('Library not found');
    }

    if (!library._id) {
      throw new NotFoundError('Invalid library ID');
    }

    // Prepare S3 key
    const s3Key = `users/${library.userId}/library/${library._id}/raw/${filename}`;

    // Create upload record
    const upload = new LibraryUpload({
      libraryId,
      fileName: filename,
      fileSize: size,
      originalName: originalname,
      mimeType: mimetype,
      s3Key,
      s3Bucket: S3_BUCKET,
      uploadStatus: 'PENDING'
    });

    try {
      // Get metadata from file
      const isImage = mimetype.startsWith('image/');
      if (isImage) {
        // For images, set a default duration of 0
        upload.duration = 5;
      } else {
        const metadata = await getMetadata(path);
        upload.duration = metadata.format.duration ?? 100;
      }

      await upload.save();

      // Upload to S3
      await uploadToS3(path, s3Key, {
        mimeType: mimetype,
        originalName: originalname,
        fileSize: size,
        userId: userId
      });

      logger.info('Successfully uploaded library file', {
        'User ID': userId
      });

      // Update upload status
      upload.uploadStatus = 'COMPLETED';
      const url = getS3FileUrl(s3Key);
      upload.url = url;
      await upload.save();

      // Add to library's processed files
      await libraryRepository.addProcessedFilesToLibrary(libraryId, upload._id.toString(), '', 'NEW');

      return {
        uploadId: upload._id.toString(),
        duration: upload.duration,
        name: originalname,
        url
      };
    } catch (error) {
      upload.uploadStatus = 'FAILED';
      await upload.save();
      throw error;
    }
  }

  /**
   * Generate a presigned URL for direct S3 upload
   */
  async generateUploadUrl(
    libraryId: string,
    userId: string,
    fileInfo: {
      filename: string;
      contentType: string;
      size: number;
      duration?: number;
    }
  ): Promise<{
    uploadId: string;
    presignedUrl: string;
    s3Key: string;
  }> {
    logger.info('Generating presigned URL for library file upload', {
      'User ID': userId,
      'Library ID': libraryId,
      Filename: fileInfo.filename
    });

    // Check user profile and storage limits
    const userProfile = await UserProfile.findOne({ firebaseId: userId });
    if (!userProfile) {
      throw new NotFoundError('User profile not found');
    }

    // if ((await userProfile.getStorageGbRemaining()) <= 0 && !userProfile.isAdmin && ENVIRONMENT === 'prod') {
    //   throw new BadRequestError('You have no storage remaining in your subscription.');
    // }

    // Validate file info
    const { filename, contentType, size, duration } = fileInfo;

    if (!libraryId || !filename || !size || !contentType) {
      throw new BadRequestError('Missing required parameters');
    }

    // Find the library
    const library = await libraryRepository.findById(libraryId);
    if (!library) {
      throw new NotFoundError('Library not found');
    }

    if (!library._id) {
      throw new NotFoundError('Invalid library ID');
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const ext = filename.substring(filename.lastIndexOf('.'));
    const uniqueFilename = `${timestamp}-${filename}`;

    // Prepare S3 key
    const s3Key = `users/${library.userId}/library/${library._id}/raw/${uniqueFilename}`;

    // Create upload record in pending state
    const upload = new LibraryUpload({
      libraryId,
      fileName: uniqueFilename,
      fileSize: size,
      originalName: filename,
      mimeType: contentType,
      userId,
      s3Key,
      s3Bucket: S3_BUCKET,
      uploadStatus: 'PENDING',
      ...(duration !== undefined && { duration })
    });

    await upload.save();

    // Generate presigned URL
    const presignedUrl = await generatePresignedUploadUrl(s3Key, contentType, 3600); // 1 hour expiry

    logger.info('Generated presigned URL for library file upload', {
      'User ID': userId,
      'Library ID': libraryId,
      'Upload ID': upload._id.toString()
    });

    return {
      uploadId: upload._id.toString(),
      presignedUrl,
      s3Key
    };
  }

  /**
   * Confirm successful upload and finalize the upload record
   */
  async confirmUpload(
    libraryId: string,
    uploadId: string,
    userId: string
  ): Promise<{
    uploadId: string;
    duration: number;
    name: string;
    url: string;
  }> {
    logger.info('Confirming library file upload', {
      'User ID': userId,
      'Library ID': libraryId,
      'Upload ID': uploadId
    });

    // Find the upload record
    const upload = await LibraryUpload.findById(uploadId);
    if (!upload) {
      throw new NotFoundError('Upload record not found');
    }

    if (upload.uploadStatus !== 'PENDING') {
      throw new BadRequestError('Upload is not in pending state');
    }

    // Verify the file exists in S3
    const verification = await verifyS3Upload(upload.s3Key);
    if (!verification.exists) {
      upload.uploadStatus = 'FAILED';
      await upload.save();
      throw new NotFoundError('File not found in S3');
    }

    // Set public-read ACL on the uploaded file
    // This is done after upload since presigned URLs can't include ACL (causes 403 if ACLs disabled)
    await setPublicReadAcl(upload.s3Key);

    try {
      // Use duration from frontend if available, otherwise use fallbacks
      if (upload.duration === undefined || upload.duration === 0) {
        const isImage = upload.mimeType.startsWith('image/');
        if (isImage) {
          upload.duration = 5; // 5 seconds default for images
        } else {
          upload.duration = 60; // 60 seconds default for videos/audio
        }

        logger.info('Using fallback duration for library upload', {
          'Upload ID': uploadId,
          Duration: upload.duration,
          Reason: 'No frontend duration provided'
        });
      } else {
        logger.info('Using frontend-provided duration for library upload', {
          'Upload ID': uploadId,
          Duration: upload.duration
        });
      }

      // Update upload status and URL
      upload.uploadStatus = 'COMPLETED';
      upload.url = getS3FileUrl(upload.s3Key);
      upload.fileSize = verification.size || upload.fileSize;

      await upload.save();

      // Add to library's processed files
      await libraryRepository.addProcessedFilesToLibrary(libraryId, upload._id.toString(), '', 'NEW');

      logger.info('Successfully confirmed library file upload', {
        'User ID': userId,
        'Library ID': libraryId,
        'Upload ID': uploadId
      });

      return {
        uploadId: upload._id.toString(),
        duration: upload.duration,
        name: upload.originalName,
        url: upload.url
      };
    } catch (error) {
      upload.uploadStatus = 'FAILED';
      await upload.save();
      throw error;
    }
  }

  async generateHashesForAll() {
    const batchSize = 200;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch brolls in batches
      const brolls = await BrollFootageMetadata.find({
        isDeleted: { $ne: true },
        perceptualHash: { $exists: false }
      })
        .skip(skip)
        .limit(batchSize);

      if (brolls.length === 0) {
        hasMore = false;
        break;
      }

      logger.info(`Processing batch of ${brolls.length} brolls (skip: ${skip})`);

      // Process current batch - 5 brolls at a time in parallel
      const brollBatchSize = 50;
      for (let i = 0; i < brolls.length; i += brollBatchSize) {
        const brollBatch = brolls.slice(i, i + brollBatchSize);

        await Promise.all(
          brollBatch.map(async broll => {
            if (!broll.libraryId) {
              logger.error('Broll has no library ID', {
                'Broll ID': broll._id
              });
              return;
            }
            const library = await libraryRepository.findById(broll.libraryId);
            if (!library?.userId) {
              logger.error('Library not found', {
                'Broll ID': broll._id,
                'Library ID': broll.libraryId
              });
              return;
            }
            await enqueueLibraryItemHashGenerationTask({
              brollId: broll._id.toString(),
              userId: library.userId,
              version: '1.0.0'
            });
          })
        );
      }

      // Move to next batch
      skip += batchSize;

      // If we got fewer results than the batch size, we've reached the end
      if (brolls.length < batchSize) {
        hasMore = false;
      }
    }

    logger.info('Finished processing all brolls for hash generation');
  }

  /**
   * Mark all broll footage in a library as hasVideoEmbeddings = false and enqueue video embedding tasks
   */
  async resetAndReprocessVideoEmbeddings(libraryId: string): Promise<{ processed: number; message: string }> {
    // Verify that the library exists
    const library = await libraryRepository.findById(libraryId);
    if (!library) {
      throw new NotFoundError('Library not found');
    }

    const userId = library.userId;

    // First, mark all broll footage in this library as hasVideoEmbeddings = false
    await BrollFootageMetadata.updateMany(
      { libraryId, isDeleted: { $ne: true } },
      { $set: { hasVideoEmbeddings: false } }
    );

    logger.info('Marked all broll footage as hasVideoEmbeddings = false', {
      'Library ID': libraryId,
      'User ID': userId
    });

    // Get all broll footage for this library that is not deleted
    const brolls = await brollRepository.findByLibraryId(libraryId, 0, Number.MAX_SAFE_INTEGER);

    if (!brolls.broll || brolls.broll.length === 0) {
      return {
        processed: 0,
        message: 'No broll footage found in this library'
      };
    }

    // Process brolls in chunks to avoid overwhelming the queue
    const chunkSize = 10;
    let processedCount = 0;

    for (let i = 0; i < brolls.broll.length; i += chunkSize) {
      const brollChunk = brolls.broll.slice(i, i + chunkSize);

      await Promise.all(
        brollChunk.map(async broll => {
          // Check if broll has URL (required for video embedding)
          if (!broll.url) {
            logger.info('Broll does not have video URL, skipping', {
              'Broll ID': broll._id!
            });
            return;
          }

          // Enqueue video embedding task
          await enqueueLibraryItemVideoEmbeddingTask({
            brollId: broll._id!.toString(),
            userId,
            version: '1.0.0'
          });

          processedCount++;

          logger.info('Enqueued video embedding task for broll', {
            'Broll ID': broll._id!,
            'Library ID': libraryId,
            'User ID': userId
          });
        })
      );
    }

    logger.info('Completed enqueuing video embedding tasks for library', {
      'Library ID': libraryId,
      'User ID': userId,
      'Processed Count': processedCount,
      'Total Brolls': brolls.broll.length
    });

    return {
      processed: processedCount,
      message: `Reset and enqueued ${processedCount} video embedding tasks for library ${library.title}`
    };
  }

  /**
   * Get libraries by IDs (only basic info, no video counts)
   */
  async getLibrariesByIds(libraryIds: string[], userId: string): Promise<{ _id: string; title: string }[]> {
    // Get the public libraries by IDs
    const libraries = await libraryRepository.findPublicLibrariesByIds(libraryIds);

    // Filter out libraries owned by the current user and return only basic info
    return libraries
      .filter(library => {
        return library.userId !== userId;
      })
      .map(library => ({
        _id: library._id!.toString(),
        title: library.title
      }));
  }

  /**
   * Get library statistics by user
   */
  async getLibraryStatsByUser(days: number = 25): Promise<Array<{ _id: string; count: number }>> {
    return await libraryRepository.getLibraryStatsByUser(days);
  }

  /**
   * Get ALL libraries across all users with pagination (for secret admin page)
   * ONLY ACCESSIBLE IN UAT ENVIRONMENT
   */
  async getAllLibrariesForAdmin(skip: number = 0, limit: number = 50) {
    if (ENVIRONMENT !== 'uat') {
      throw new UnauthorizedError('This endpoint is only available in UAT environment');
    }

    return await libraryRepository.findAllLibrariesWithPagination(skip, limit);
  }

  /**
   * Get library items grouped by perceptualHash to identify duplicates
   * Uses MongoDB aggregation for efficient grouping at the database level
   * Supports pagination for large libraries
   */
  async getDuplicatesByHash(
    libraryId: string,
    userId: string,
    skip: number = 0,
    limit: number = 20
  ): Promise<{
    duplicates: Array<{
      hash: string;
      items: IBrollFootageMetadata[];
      count: number;
    }>;
    totalDuplicateGroups: number;
    totalDuplicates: number;
    totalItems: number;
    skip: number;
    limit: number;
  }> {
    // Verify library ownership
    const library = await libraryRepository.findByIdAndUserId(libraryId, userId);
    if (!library) {
      throw new NotFoundError('Library not found');
    }

    // Build aggregation pipeline for counting total duplicate groups
    const countPipeline = [
      {
        $match: {
          libraryId: getObjectId(libraryId),
          isDeleted: { $ne: true },
          perceptualHash: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$perceptualHash',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $count: 'total'
      }
    ];

    // Get total count of duplicate groups
    const countResult = await BrollFootageMetadata.aggregate(countPipeline);
    const totalDuplicateGroups = countResult[0]?.total ?? 0;

    // Use aggregation pipeline to group by hash at the database level with pagination
    const hashGroups = await BrollFootageMetadata.aggregate([
      // Match items for this library that have a hash
      {
        $match: {
          libraryId: getObjectId(libraryId),
          isDeleted: { $ne: true },
          perceptualHash: { $exists: true, $ne: null }
        }
      },
      // Group by hash and collect all items
      {
        $group: {
          _id: '$perceptualHash',
          items: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      // Filter to only groups with duplicates (more than 1 item)
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      // Sort by count descending
      {
        $sort: { count: -1 }
      },
      // Pagination
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]);

    // Get total count of items with hashes
    const totalItems = await BrollFootageMetadata.countDocuments({
      libraryId: getObjectId(libraryId),
      isDeleted: { $ne: true },
      perceptualHash: { $exists: true, $ne: null }
    });

    // Transform aggregation results to match expected format
    const duplicates = hashGroups.map(group => {
      // Sort items within each group by createdAt descending (newest first)
      const sortedItems = group.items.sort((a: IBrollFootageMetadata, b: IBrollFootageMetadata) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });

      // Log groups with more than 2 items for debugging
      if (group.count > 2) {
        logger.info('Found duplicate group with more than 2 items', {
          hash: group._id,
          count: group.count,
          libraryId
        });
      }

      return {
        hash: group._id,
        items: sortedItems,
        count: group.count
      };
    });

    // Calculate total duplicates (count - 1 for each group, since we keep one original)
    // For paginated results, we only calculate for the current page
    const totalDuplicates = duplicates.reduce((sum, group) => sum + group.count - 1, 0);

    return {
      duplicates,
      totalDuplicateGroups,
      totalDuplicates,
      totalItems,
      skip,
      limit
    };
  }
}

export default new LibraryService();

function groupFilesIntoChunks(
  uploadedFiles: Array<{ uploadId: string; duration: number; link: string }>
) {
  const maxDuration = 10 * 60; // 10 minutes in seconds
  const chunks: Array<{ files: Array<{ fileId: string; duration: number; link: string }> }> = [{ files: [] }];
  let currentChunkDuration = 0;

  uploadedFiles.forEach(file => {
    if (currentChunkDuration + file.duration > maxDuration) {
      chunks.push({ files: [] });
      currentChunkDuration = 0;
    }
    chunks[chunks.length - 1].files.push({ fileId: file.uploadId, duration: file.duration, link: file.link });
    currentChunkDuration += file.duration;
  });

  return chunks;
}
