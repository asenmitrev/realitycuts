import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ITranscriptionJob } from '../types';
import './define-getters';
const BATCH_LIMIT = 90;

interface TranscriptionJobModel extends mongoose.Model<ITranscriptionJob> {
  getAvailableBatchName(): Promise<string>;
}
const transcriptionJobSchema = new mongoose.Schema<ITranscriptionJob, TranscriptionJobModel>(
  {
    userId: String,
    videoUrl: String,
    thumbnailUrl: String,
    isAiThumbnail: Boolean,
    audioUrl: String,
    title: String,
    batchName: String,
    filename: String,
    script: String,
    guidance: String,
    includeMusic: Boolean,
    metadata: mongoose.Schema.Types.Mixed,
    deepgramResults: mongoose.Schema.Types.Mixed,
    isDeleted: { type: Boolean, index: true },
    pinecone: Boolean,
    brollDuration: Number,
    transcript: [
      {
        word: String,
        start: Number,
        end: Number,
        confidence: Number,
        wordIndex: Number,
        punctuated_word: String,
        speaker: Number,
        speaker_confidence: Number,
        isVisible: Boolean,
        isParagraphEnd: Boolean
      }
    ],
    isAudioOnly: Boolean,
    jobType: {
      type: String,
      index: true,
      enum: ['B_ROLL', 'HIGHLIGHT', 'HIGHLIGHT_B_ROLL', 'SCRIPT', 'AUDIO', 'PROMPT']
    },
    status: {
      type: String,
      index: true,
      enum: ['VIDEO_RECEIVED', 'CREATED', 'QUEUED', 'TRANSCRIBED', 'COMPLETED', 'FAILED', 'INSUFFICIENT_FOOTAGE']
    }
  },
  { timestamps: true }
);

transcriptionJobSchema.index({ userId: 1, isDeleted: 1, status: 1 });
transcriptionJobSchema.static('getAvailableBatchName', async function () {
  const BatchModel = TranscriptionJob;

  const distinctPropertyValues = await BatchModel.distinct('batchName');

  for (const value of distinctPropertyValues) {
    const count = await TranscriptionJob.countDocuments({ batchName: value });

    if (count < BATCH_LIMIT) {
      return value;
    }
  }

  const newBatchName = uuidv4();

  return newBatchName;
});

export const TranscriptionJob = mongoose.model<ITranscriptionJob, TranscriptionJobModel>(
  'TranscriptionJob',
  transcriptionJobSchema
);
