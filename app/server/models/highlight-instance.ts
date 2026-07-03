import mongoose from 'mongoose';
import { IHighlightInstance } from '../types';

import './define-getters';
const HighlightInstanceSchema = new mongoose.Schema<IHighlightInstance>(
  {
    startIndex: Number,
    endIndex: Number,
    previews: [String],
    verticalPreviews: [String],
    title: String,
    score: Number,
    isAcceptedForEditing: Boolean,
    source: {
      url: String,
      metadata: mongoose.Schema.Types.Mixed,
      thumbnail: String
    },
    editedWordsList: [
      {
        word: String,
        start: Number,
        end: Number,
        confidence: Number,
        wordIndex: Number,
        punctuated_word: String,
        speaker: Number,
        speaker_confidence: Number,
        isVisible: Boolean
      }
    ],
    highlightData: {
      index: true,
      type: mongoose.Schema.ObjectId,
      ref: 'HighlightData2'
    }
  },
  { timestamps: true }
);

HighlightInstanceSchema.virtual('videoAIData', {
  ref: 'VideoAIData2', // The model to use
  localField: '_id', // Find VideoAIData2 where `localField`
  foreignField: 'highlightInstanceId', // is equal to `foreignField`
  justOne: true // set to false since we want to retrieve multiple VideoAIData2
});

HighlightInstanceSchema.set('toObject', { virtuals: true });
HighlightInstanceSchema.set('toJSON', { virtuals: true });

export const HighlightInstance = mongoose.model('HighlightInstance2', HighlightInstanceSchema);
