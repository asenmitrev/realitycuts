import mongoose from 'mongoose';
import { ICutterJob } from '../types';
import './define-getters';

const cutterJobSchema = new mongoose.Schema<ICutterJob>(
  {
    userId: String,
    inputPath: String,
    highlightId: String,
    highlightInstanceId: String,
    isVertical: Boolean,
    eventId: String,
    segments: [
      {
        start: Number,
        end: Number
      }
    ],
    status: {
      type: String,
      enum: ['QUEUED', 'PROCESSING', 'COMPLETE', 'FAILED']
    }
  },
  { timestamps: true }
);

export const CutterJob = mongoose.model('CutterJob', cutterJobSchema);
