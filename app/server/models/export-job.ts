import mongoose from 'mongoose';
import { IExportJob } from '../types';
import './define-getters';
import { VideoAIData } from './video-ai-data';

const exportJobSchema = new mongoose.Schema<IExportJob>(
  {
    userId: String,
    // @ts-ignore
    videoDataId: {
      type: mongoose.Schema.ObjectId,
      ref: VideoAIData
    },
    videoUrl: String,
    extraVideoUrl: String,
    isDeleted: Boolean,
    isWatermarked: Boolean,
    exportType: {
      type: String,
      enum: ['CAPTIONS', 'VIDEO_CAPTIONS', 'VIDEO', 'FCPXML']
    },
    orientationType: {
      type: String,
      enum: ['BOTH', 'HORIZONTAL', 'VERTICAL']
    },
    brandWatermarkUploadId: { type: String },
    brandWatermarkPosition: {
      type: String,
      enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']
    },
    status: {
      type: String,
      enum: ['QUEUED', 'PROCESSING', 'UPLOADING', 'COMPLETED', 'FAILED', 'IN_REVIEW']
    },
    generateThumbnail: Boolean,
    thumbnailUrl: String
  },
  { timestamps: true, toObject: { getters: true } }
);

export const ExportJob = mongoose.model('ExportJob', exportJobSchema);
