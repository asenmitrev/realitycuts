import mongoose from 'mongoose';
import { IS3Upload } from '../types';
import './define-getters';
const s3UploadSchema = new mongoose.Schema<IS3Upload>(
  {
    fileName: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number
    },
    mimeType: {
      type: String
    },
    userId: {
      type: String,
      ref: 'UserProfile',
      required: true
    },
    s3Key: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    s3Bucket: {
      type: String,
      required: true
    },
    expires: {
      type: Date,
      index: true
    },
    url: {
      type: String
    },
    uploadStatus: {
      type: String,
      index: true,
      enum: ['UPLOADING', 'COMPLETED', 'FAILED', 'DELETED'],
      default: 'UPLOADING'
    },
    duration: {
      type: Number
    }
  },
  { timestamps: true }
);

s3UploadSchema.index({ userId: 1, createdAt: -1 });

export const S3Upload = mongoose.model('S3Upload', s3UploadSchema);
