import mongoose from 'mongoose';
import { ILibrary } from '../types';
import { calculateTotalProgress } from 'shared/utils/misc';
import './define-getters';
const librarySchema = new mongoose.Schema<ILibrary>(
  {
    userId: {
      type: String,
      index: true,
      required: true
    },
    title: String,
    description: String,
    isPublic: {
      type: Boolean,
      default: false
    },
    processedFiles: [
      {
        link: {
          type: String,
          ref: 'LibraryUpload'
        },
        prompt: String,
        status: {
          type: String,
          enum: ['NEW', 'PROCESSING', 'PROCESSED', 'FAILED']
        }
      }
    ],
    tags: [String],
    apifyRunId: String,
    progress: {
      type: Number,
      default: 0
    },
    asyncProgress: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      index: true,
      enum: ['NEW', 'REPROCESSING', 'QUEUED', 'PROCESSING', 'PROCESSED', 'TAGGING', 'FAILED', 'DELETED'],
      default: 'NEW'
    },
    // One-shot pipeline: set before library processing starts; triggers video generation on completion
    pendingOneShotJob: {
      prompt: String,
      tjId: String
    },
    // Clustering metadata
    clusteringMetadata: {
      totalClusters: {
        type: Number,
        default: 0
      },
      clusteringVersion: {
        type: Number,
        default: 1
      },
      clusteringDate: {
        type: Date,
        default: null
      },
      clusterStats: [
        {
          clusterId: Number,
          videoCount: Number,
          keywords: [String],
          sampleVideoIds: [mongoose.Schema.Types.ObjectId]
        }
      ],
      totalClusteredVideos: {
        type: Number,
        default: 0
      },
      noiseVideos: {
        type: Number,
        default: 0
      }
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true
  }
);
librarySchema.index({ userId: 1, status: 1 });
librarySchema.virtual('totalProgress').get(function () {
  return calculateTotalProgress(this);
});

export const Library = mongoose.model('Library', librarySchema);
