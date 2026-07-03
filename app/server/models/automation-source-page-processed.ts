import mongoose from 'mongoose';
import './define-getters';

/** Marks a PDF page as fully processed (idempotency for SQS redelivery). */
const schema = new mongoose.Schema(
  {
    sourceUploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'S3Upload',
      required: true
    },
    pageNumber: { type: Number, required: true },
    automationConfigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AutomationConfig',
      required: true
    }
  },
  { timestamps: true }
);

schema.index({ sourceUploadId: 1, pageNumber: 1 }, { unique: true });

export const AutomationSourcePageProcessed = mongoose.model('AutomationSourcePage', schema);
