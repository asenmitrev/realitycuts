import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectAclCommand,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import {
  getS3FileUrl,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_PUBLIC_ENDPOINT,
  S3_ACCESS_KEY,
  S3_SECRET_KEY
} from '../../config/storage';
import { S3Upload } from '../../models/s3-upload';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import { logger } from '../logging';

/**
 * S3Client configured for MinIO (S3-compatible).
 */
const s3 = new S3Client({
  region: 'us-east-1', // MinIO ignores this but requires a region
  endpoint: S3_ENDPOINT,
  forcePathStyle: true, // MinIO requires path-style bucket URLs
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
});

/**
 * Client used only for presigning URLs handed to the browser. It must point at
 * the endpoint the browser can reach (e.g. http://localhost:9000), not the
 * compose-internal http://minio:9000, because the signature covers the host.
 */
const s3Public =
  S3_PUBLIC_ENDPOINT === S3_ENDPOINT
    ? s3
    : new S3Client({
        region: 'us-east-1',
        endpoint: S3_PUBLIC_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: S3_ACCESS_KEY,
          secretAccessKey: S3_SECRET_KEY,
        },
      });

export const getKeyFromUrl = (url: string) => url.replace(getS3FileUrl(''), '') ?? '';

export const s3UploadMulter = multer({
  storage: multerS3({
    // @ts-ignore
    s3: s3,
    acl: 'public-read',
    cacheControl: 'max-age=31536000',
    bucket: S3_BUCKET,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const filename = Date.now().toString();
      const filename_full = `${filename}${ext}`;
      cb(null, filename_full);
    }
  })
});

export async function getS3ObjectBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Key: key,
    Bucket: S3_BUCKET
  });
  const out = await s3.send(command);
  if (!out.Body) {
    throw new Error('Empty S3 body');
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of out.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function putS3ObjectString(
  key: string,
  body: string,
  contentType: string = 'application/json'
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'max-age=31536000'
    })
  );
}

/** Server-side copy within the app bucket (e.g. temp-uploads → automation-sources). */
export async function copyS3ObjectWithinBucket(sourceKey: string, destKey: string): Promise<void> {
  await s3.send(
    new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
      Key: destKey,
      ACL: 'public-read',
      MetadataDirective: 'COPY'
    })
  );
}

export async function getTextFromS3(fileurl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = new GetObjectCommand({
      Key: getKeyFromUrl(fileurl),
      Bucket: S3_BUCKET
    });
    s3.send(command, async (err, success) => {
      if (err) {
        return reject(err);
      }
      if (!success) {
        return;
      }
      try {
        const result = await success.Body?.transformToString();
        if (!result) {
          reject('Cannot download file');
        } else {
          resolve(result);
        }
      } catch (err) {
        logger.error('Error getting text from S3', {
          Error: err
        });
      }
    });
  });
}

export async function uploadToS3(
  filepath: string,
  filename: string,
  metadata: {
    mimeType: string;
    originalName: string;
    fileSize: number;
    userId: string;
  },
  expires?: Date,
  bucket?: string
) {
  return new Promise(async (resolve, reject) => {
    try {
      const command = new PutObjectCommand({
        ACL: 'public-read',
        Key: filename,
        Body: fs.createReadStream(filepath),
        Bucket: bucket ?? S3_BUCKET,
        ContentType: metadata.mimeType,
        Expires: expires,
        CacheControl: 'max-age=31536000'
      });

      const dbModel = await S3Upload.findOneAndUpdate(
        { s3Key: filename },
        {
          fileName: filename,
          fileSize: metadata.fileSize,
          mimeType: metadata.mimeType,
          s3Key: filename,
          s3Bucket: bucket ?? S3_BUCKET,
          expires,
          originalName: metadata.originalName,
          userId: metadata.userId
        },
        { upsert: true, new: true }
      );
      s3.send(command, async (err, success) => {
        if (err) {
          dbModel.uploadStatus = 'FAILED';
          reject(err);
        } else {
          dbModel.uploadStatus = 'COMPLETED';
          dbModel.url = getS3FileUrl(filename);
          resolve(success);
        }
        try {
          await dbModel.save();
        } catch (err) {
          logger.error('Error saving S3 upload', {
            Error: err,
            'S3 Key': filename
          });
        }
      });
    } catch (err) {
      logger.error('Error uploading to S3', {
        Error: err,
        'S3 Key': filename
      });
      reject(err);
    }
  });
}

export function deleteFromS3(filename: string, cb: (err: unknown) => void) {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: filename
  });

  s3.send(command, async (err, success) => {
    if (err) {
      cb(err);
    } else {
      try {
        await S3Upload.findOneAndUpdate({ s3Key: filename }, { uploadStatus: 'DELETED' });
        cb(null);
      } catch (err) {
        cb(err);

        logger.error('Error deleting S3 upload', {
          Error: err,
          'S3 Key': filename
        });
      }
    }
  });
}
export const deleteFromS3Promise = async (filename: string) =>
  new Promise((resolve, reject) => {
    deleteFromS3(filename, err => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });

/**
 * Generate a presigned URL for direct S3 upload
 */
export async function generatePresignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn: number = 3600, // 1 hour default
  metadata?: Record<string, string>
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
    // Add metadata if provided
    ...(metadata && { Metadata: metadata })
  });

  try {
    const signedUrl = await getSignedUrl(s3Public, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    logger.error('Error generating presigned URL', {
      Error: error,
      'S3 Key': s3Key
    });
    throw error;
  }
}

/**
 * Verify that a file exists in S3 and get its metadata
 */
export async function verifyS3Upload(s3Key: string): Promise<{
  exists: boolean;
  size?: number;
  contentType?: string;
  lastModified?: Date;
}> {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key
    });

    const response = await s3.send(command);

    return {
      exists: true,
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified
    };
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }

    logger.error('Error verifying S3 upload', {
      Error: error,
      'S3 Key': s3Key
    });
    throw error;
  }
}

export async function checkYoutubeFileExists(key: string): Promise<boolean> {
  const command = new HeadObjectCommand({
    Bucket: S3_BUCKET,
    Key: key
  });

  try {
    await s3.send(command);
    return true;
  } catch (err) {
    // If file doesn't exist, HeadObject returns 404 error
    if ('$metadata' in (err as any) && (err as any).$metadata?.httpStatusCode === 404) {
      return false;
    }
    // For other errors, log and return false
    logger.info('Youtube file not found.', {
      // Error: err,
      Key: key
    });
    return false;
  }
}
export async function getUserStorageUsed(userId: string) {
  // In GB
  const uploads = await S3Upload.aggregate([
    { $match: { userId, uploadStatus: { $ne: 'DELETED' } } },
    { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
  ]);

  return (uploads[0]?.totalSize ?? 0) / (1024 * 1024 * 1024);
}

export async function softDeleteS3Uploads(s3Key: string) {
  await S3Upload.updateMany({ s3Key, uploadStatus: { $ne: 'DELETED' } }, { uploadStatus: 'DELETED' });
}

/**
 * Set public-read ACL on an S3 object after upload
 * This is used when presigned URLs don't include ACL (to avoid 403 errors)
 */
export async function setPublicReadAcl(s3Key: string): Promise<void> {
  try {
    const command = new PutObjectAclCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      ACL: 'public-read'
    });

    await s3.send(command);
    logger.info('Successfully set public-read ACL on S3 object', {
      'S3 Key': s3Key
    });
  } catch (error: any) {
    // If ACLs are disabled on the bucket, log a warning but don't fail
    if (error.name === 'AccessControlListNotSupported' || error.$metadata?.httpStatusCode === 400) {
      logger.warn('ACLs are disabled on S3 bucket, skipping ACL setting', {
        'S3 Key': s3Key,
        Note: 'File should be accessible via local proxy if bucket policy allows'
      });
    } else {
      logger.error('Error setting public-read ACL on S3 object', {
        Error: error,
        'S3 Key': s3Key
      });
      // Don't throw - allow upload to succeed even if ACL setting fails
    }
  }
}
