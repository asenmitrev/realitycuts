/**
 * Upload Service for Presigned URL Uploads
 *
 * This service handles video/audio uploads with 24-hour expiration.
 * Files are automatically cleaned up by S3 using one of these methods:
 *
 * 1. S3 Lifecycle Policies (Recommended):
 *    - Configure a lifecycle policy on the S3 bucket to delete objects in
 *      the "temp-uploads/" prefix after 1 day
 *    - This is the most efficient approach and requires no Lambda functions
 *
 * 2. Object Metadata (Alternative):
 *    - Objects are tagged with expiration metadata when uploaded
 *    - A separate process can use this metadata for cleanup if needed
 *
 * Database records can be cleaned up using the cleanupExpiredDatabaseRecords() method.
 */

import { logger } from './logging';
import { NotFoundError, BadRequestError } from '../errors';
import { generatePresignedUploadUrl, verifyS3Upload, deleteFromS3Promise, setPublicReadAcl } from './storage/s3';
import { S3Upload } from '../models/s3-upload';
import { UserProfile } from '../models/user-profile';
import { getS3FileUrl, S3_BUCKET } from '../config/storage';
import { ENVIRONMENT } from '../config/const';

export class UploadService {
  /**
   * Generate a presigned URL for direct S3 upload with 24-hour expiration
   * S3 will automatically delete the file after 24 hours using object expiration
   */
  async generatePresignedUploadUrl(
    userId: string,
    fileInfo: {
      filename: string;
      contentType: string;
      size: number;
      duration?: number;
    },
    expiresIn: number = 24 * 3600
  ): Promise<{
    uploadId: string;
    presignedUrl: string;
    s3Key: string;
  }> {
    logger.info('Generating presigned URL for video/audio upload', {
      'User ID': userId,
      Filename: fileInfo.filename,
      'Content Type': fileInfo.contentType,
      Size: fileInfo.size
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

    if (!filename || !size || !contentType) {
      throw new BadRequestError('Missing required parameters: filename, contentType, and size are required');
    }

    // Validate file type
    const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'];
    const allowedAudioTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/aac'];
    const allowedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    const allowedPdfTypes = ['application/pdf'];
    const allowedTypes = [...allowedVideoTypes, ...allowedAudioTypes, ...allowedImageTypes, ...allowedPdfTypes];

    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestError(
        'Invalid file type. Supported video types: MP4, AVI, MOV, WMV, FLV, WebM; audio: MP3, WAV, M4A, AAC; images: PNG, JPEG, WEBP, SVG; documents: PDF'
      );
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const ext = filename.substring(filename.lastIndexOf('.'));
    const uniqueFilename = `${timestamp}-${filename}`;

    // Prepare S3 key for temporary uploads
    const s3Key = `users/${userId}/temp-uploads/${uniqueFilename}`;

    // Set expiration to 24 hours from now (for database tracking)
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + 24);

    // Create upload record in pending state
    const upload = new S3Upload({
      fileName: uniqueFilename,
      fileSize: size,
      originalName: filename,
      mimeType: contentType,
      userId,
      s3Key,
      s3Bucket: S3_BUCKET,
      uploadStatus: 'UPLOADING',
      expires: expirationTime,
      ...(duration !== undefined && { duration })
    });

    await upload.save();

    // Generate presigned URL with 24 hour expiry and S3 object expiration
    const presignedUrl = await generatePresignedUploadUrl(s3Key, contentType, expiresIn);

    logger.info('Generated presigned URL for upload', {
      'User ID': userId,
      'Upload ID': upload._id.toString(),
      'Expires At': expirationTime.toISOString(),
      Note: 'S3 object will auto-expire after 24 hours'
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
    uploadId: string,
    userId: string
  ): Promise<{
    uploadId: string;
    duration: number;
    name: string;
    url: string;
    fileSize: number;
  }> {
    logger.info('Confirming upload', {
      'User ID': userId,
      'Upload ID': uploadId
    });

    // Find the upload record
    const upload = await S3Upload.findById(uploadId);
    if (!upload) {
      throw new NotFoundError('Upload record not found');
    }

    if (upload.userId !== userId) {
      throw new NotFoundError('Upload not found'); // Don't expose that it exists for another user
    }

    if (upload.uploadStatus !== 'UPLOADING') {
      throw new BadRequestError('Upload is not in uploading state');
    }

    // Check if upload has expired
    if (upload.expires && upload.expires < new Date()) {
      upload.uploadStatus = 'FAILED';
      await upload.save();
      throw new BadRequestError('Upload has expired');
    }

    // Verify the file exists in S3
    const verification = await verifyS3Upload(upload.s3Key);
    if (!verification.exists) {
      upload.uploadStatus = 'FAILED';
      await upload.save();
      throw new NotFoundError('File not found in S3. Please re-upload the file.');
    }

    // Set public-read ACL on the uploaded file
    // This is done after upload since presigned URLs can't include ACL (causes 403 if ACLs disabled)
    await setPublicReadAcl(upload.s3Key);

    try {
      // Use duration from frontend if available, otherwise fallback
      let duration = upload.duration || 0;

      // If no duration was provided by frontend, use fallbacks
      if (duration === 0) {
        if (upload.mimeType.startsWith('image/')) {
          duration = 5; // 5 seconds for images
        } else {
          duration = 60; // 60 seconds default for audio/video
        }

        logger.info('Using fallback duration for upload', {
          'Upload ID': uploadId,
          Duration: duration,
          Reason: 'No frontend duration provided'
        });
      } else {
        logger.info('Using frontend-provided duration for upload', {
          'Upload ID': uploadId,
          Duration: duration
        });
      }

      // Update upload status and metadata
      upload.uploadStatus = 'COMPLETED';
      upload.url = getS3FileUrl(upload.s3Key);
      upload.fileSize = verification.size || upload.fileSize;

      await upload.save();

      logger.info('Successfully confirmed upload', {
        'User ID': userId,
        'Upload ID': uploadId,
        Duration: duration,
        Note: 'File will auto-expire from S3 in 24 hours'
      });

      return {
        uploadId: upload._id.toString(),
        duration,
        name: upload.originalName,
        url: upload.url!,
        fileSize: upload.fileSize
      };
    } catch (error) {
      upload.uploadStatus = 'FAILED';
      await upload.save();
      throw error;
    }
  }

  /**
   * Get upload by ID (for the user who owns it)
   */
  async getUpload(uploadId: string, userId: string) {
    const upload = await S3Upload.findById(uploadId);
    if (!upload) {
      throw new NotFoundError('Upload not found');
    }

    if (upload.userId !== userId) {
      throw new NotFoundError('Upload not found'); // Don't expose that it exists for another user
    }

    return upload;
  }

  /**
   * Delete an upload and its associated S3 file
   */
  async deleteUpload(uploadId: string, userId: string): Promise<void> {
    logger.info('Deleting upload', {
      'Upload ID': uploadId,
      'User ID': userId
    });

    const upload = await S3Upload.findById(uploadId);
    if (!upload) {
      throw new NotFoundError('Upload not found');
    }

    if (upload.userId !== userId) {
      throw new NotFoundError('Upload not found');
    }

    // Delete from S3 if it exists (it may have already auto-expired)
    if (upload.uploadStatus === 'COMPLETED' && upload.s3Key) {
      try {
        await deleteFromS3Promise(upload.s3Key);
      } catch (error) {
        logger.warn('Failed to delete file from S3 (may have auto-expired)', {
          'Upload ID': uploadId,
          'S3 Key': upload.s3Key,
          Error: error
        });
      }
    }

    // Mark as deleted in database
    upload.uploadStatus = 'DELETED';
    await upload.save();

    logger.info('Upload deleted successfully', {
      'Upload ID': uploadId,
      'User ID': userId
    });
  }

  /**
   * Get upload statistics for monitoring
   */
  async getUploadStats(): Promise<{
    totalActiveUploads: number;
    totalExpiredUploads: number;
    uploadsBy24Hours: Array<{ hour: string; count: number }>;
  }> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalActiveUploads, totalExpiredUploads, recentUploads] = await Promise.all([
      S3Upload.countDocuments({
        uploadStatus: { $in: ['UPLOADING', 'COMPLETED'] },
        expires: { $gt: now }
      }),
      S3Upload.countDocuments({
        expires: { $lt: now },
        uploadStatus: { $ne: 'DELETED' }
      }),
      S3Upload.find({
        createdAt: { $gte: twentyFourHoursAgo }
      }).select('createdAt')
    ]);

    // Group uploads by hour for the last 24 hours
    const uploadsBy24Hours = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      hour.setMinutes(0, 0, 0);
      return {
        hour: hour.toISOString(),
        count: 0
      };
    }).reverse();

    recentUploads.forEach(upload => {
      if (upload.createdAt) {
        const uploadHour = new Date(upload.createdAt);
        uploadHour.setMinutes(0, 0, 0);
        const hourIndex = uploadsBy24Hours.findIndex(h => new Date(h.hour).getTime() === uploadHour.getTime());
        if (hourIndex >= 0) {
          uploadsBy24Hours[hourIndex].count++;
        }
      }
    });

    return {
      totalActiveUploads,
      totalExpiredUploads,
      uploadsBy24Hours
    };
  }

  /**
   * Clean up database records for expired uploads (optional maintenance)
   * This only cleans the database records - S3 files auto-expire
   */
  async cleanupExpiredDatabaseRecords(): Promise<{ deletedCount: number }> {
    logger.info('Cleaning up expired upload database records');

    const now = new Date();

    // Find expired uploads that are not already deleted
    const result = await S3Upload.updateMany(
      {
        expires: { $lt: now },
        uploadStatus: { $ne: 'DELETED' }
      },
      {
        $set: { uploadStatus: 'DELETED' }
      }
    );

    logger.info(`Cleaned up ${result.modifiedCount} expired upload database records`);
    return { deletedCount: result.modifiedCount };
  }
}

export default new UploadService();
