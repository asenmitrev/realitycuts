import mongoose from 'mongoose';
import { IBrollFootageMetadata } from '../types';
import { ENVIRONMENT } from '../config/const';
import { logger } from 'server/services/logging';
import './define-getters';

const brollVideoMetadataSchema = new mongoose.Schema<IBrollFootageMetadata>(
  {
    title: String,
    duration: Number,
    thumbnailUrl: String,
    thumbnailUrl2: String,
    preview: String,
    tag: {
      type: String,
      index: true
    },
    namespace: String,
    originalYoutubeUrl: String,
    isVertical: Boolean,
    framing: String,
    cameraAngle: String,
    perspective: String,
    depthOfField: String,
    complexity: String,
    perceptualHash: String,
    arollBroll: String,
    arollBrollHeuristic: String,
    focusPosition: String,
    status: {
      type: String,
      enum: ['NEW', 'PROCESSING', 'PROCESSED', 'FAILED'],
      default: 'NEW'
    },
    hasVideoEmbeddings: Boolean,
    imageUrl: String,
    brollType: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'AI_PHOTO', 'SVG_INFOGRAPHIC'],
      default: 'VIDEO'
    },
    isDeleted: { type: Boolean, default: false, index: true },
    isPublic: { type: Boolean, default: false, index: true },
    libraryId: { type: mongoose.Schema.Types.ObjectId, index: true, ref: 'Library' },
    url: {
      type: String,
      index: true
    },
    videoEmbedding: {
      type: [Number],
      select: false
    },
    videoDimensions: {
      width: Number,
      height: Number,
      aspect_ratio: Number,
      orientation: String
    },
    hasFaceDetection: { type: Boolean, default: false },
    faceDetectionResults: {
      frame05s: {
        faceCount: { type: Number, default: 0 },
        faces: [
          {
            x: Number,
            y: Number,
            width: Number,
            height: Number,
            confidence: Number
          }
        ]
      },
      frame25s: {
        faceCount: { type: Number, default: 0 },
        faces: [
          {
            x: Number,
            y: Number,
            width: Number,
            height: Number,
            confidence: Number
          }
        ]
      }
    },
    // Clustering fields
    clusterId: {
      type: Number,
      index: true,
      default: null
    },
    clusterVersion: {
      type: Number,
      default: null
    },
    // Background motion analysis fields
    hasBackgroundMotionAnalysis: { type: Boolean },
    backgroundMotionScore: {
      type: Number,
      min: 0,
      max: 100
    },
    // Mouth movement scores per face
    mouthMovementScores: {
      type: [Number],
      default: [],
      validate: {
        validator: function (v: number[]) {
          return v.every((score: number) => score >= 0 && score <= 100);
        },
        message: 'Each mouth movement score must be between 0 and 100'
      }
    },
    // Maximum mouth movement score across all faces
    maxMouthMovementScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    }
  },
  { timestamps: true }
);
brollVideoMetadataSchema.index({ libraryId: 1, isDeleted: 1 });
export const BrollFootageMetadata = mongoose.model('BrollFootageMetadata', brollVideoMetadataSchema);

// Name must match the `index` used by $vectorSearch calls in vector-search.service.ts.
const VECTOR_SEARCH_INDEX_NAME = ENVIRONMENT === 'test' ? 'video_embedding_test' : 'vector_index';

// vertex.ts calls multimodalembedding@001 without an outputDimensionality override, which defaults to 1408.
const VIDEO_EMBEDDING_DIMENSIONS = 1408;

// Every field referenced in a $vectorSearch `filter` clause in vector-search.service.ts must be
// declared here as a `filter` field, or that query will fail at runtime. Keep this in sync with
// the "WHEN ADDING TO VECTOR SEARCH FILTER QUERY" comments in that file.
const VECTOR_SEARCH_INDEX_DEFINITION = {
  fields: [
    {
      type: 'vector',
      path: 'videoEmbedding',
      numDimensions: VIDEO_EMBEDDING_DIMENSIONS,
      similarity: 'cosine'
    },
    { type: 'filter', path: '_id' },
    { type: 'filter', path: 'libraryId' },
    { type: 'filter', path: 'isDeleted' },
    { type: 'filter', path: 'isPublic' },
    { type: 'filter', path: 'arollBroll' },
    { type: 'filter', path: 'arollBrollHeuristic' },
    { type: 'filter', path: 'framing' },
    { type: 'filter', path: 'cameraAngle' },
    { type: 'filter', path: 'perspective' },
    { type: 'filter', path: 'depthOfField' },
    { type: 'filter', path: 'complexity' },
    { type: 'filter', path: 'focusPosition' },
    { type: 'filter', path: 'clusterId' }
  ]
};

// Creates the Atlas Search vector index this model's $vectorSearch queries depend on if it
// doesn't already exist. Safe to call on every boot; requires mongot (Atlas or
// mongodb-atlas-local), a plain mongod will reject this.
export async function ensureBrollVectorSearchIndex(): Promise<void> {
  try {
    const existingIndexes = await BrollFootageMetadata.listSearchIndexes();
    if (existingIndexes.some(index => index.name === VECTOR_SEARCH_INDEX_NAME)) {
      return;
    }

    await BrollFootageMetadata.createSearchIndex({
      name: VECTOR_SEARCH_INDEX_NAME,
      type: 'vectorSearch',
      definition: VECTOR_SEARCH_INDEX_DEFINITION
    });
    logger.info(`Created vector search index "${VECTOR_SEARCH_INDEX_NAME}" on BrollFootageMetadata.`);
  } catch (error) {
    logger.error('Failed to ensure BrollFootageMetadata vector search index:', { error: error?.toString() });
  }
}
