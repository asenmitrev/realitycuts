import mongoose from 'mongoose';
import { IHighlightData } from '../types';
import './define-getters';

const highlightDataSchema = new mongoose.Schema<
  Omit<IHighlightData, 'transcriptionJob'> & { transcriptionJob: mongoose.Schema.Types.ObjectId }
>(
  {
    title: String,
    messages: [{ role: String, content: String }],
    transcriptionJob: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TranscriptionJob'
    },
    source: {
      url: String,
      metadata: mongoose.Schema.Types.Mixed,
      thumbnail: String
    },
    speakerMap: mongoose.Schema.Types.Mixed,
    userId: String
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true
  }
);

highlightDataSchema.virtual('highlights', {
  ref: 'HighlightInstance2',
  localField: '_id',
  foreignField: 'highlightData',
  justOne: false
});

export const HighlightData = mongoose.model('HighlightData2', highlightDataSchema);
