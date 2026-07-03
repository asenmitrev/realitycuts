import mongoose from 'mongoose';
import { ILibraryUpload } from '../types';
import './define-getters';
const libraryUploadSchema = new mongoose.Schema<ILibraryUpload>(
  {
    libraryId: {
      type: String,
      ref: 'Library',
      required: true,
      index: true
    },
    fileName: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    s3Key: {
      type: String,
      required: true,
      unique: true
    },
    originalName: {
      type: String,
      required: true
    },
    s3Bucket: {
      type: String,
      required: true
    },
    url: {
      type: String
    },
    uploadStatus: {
      type: String,
      enum: ['PENDING', 'UPLOADING', 'COMPLETED', 'FAILED'],
      default: 'PENDING'
    },
    errorMessage: String,
    duration: Number,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export const LibraryUpload = mongoose.model('LibraryUpload', libraryUploadSchema);
