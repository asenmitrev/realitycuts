import mongoose from 'mongoose';
import './define-getters';
import { IAutomationScript } from '../types';

const automationScriptSchema = new mongoose.Schema<IAutomationScript>(
  {
    automationConfigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AutomationConfig',
      required: true,
      index: true
    },
    userId: { type: String, required: true, index: true },
    topic: { type: String, required: true },
    script: { type: String, required: true },
    sourceUploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'S3Upload',
      required: true,
      index: true
    },
    sourcePageNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ['available', 'used', 'deleted'],
      default: 'available',
      index: true
    },
    usedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    order: { type: Number, required: true }
  },
  { timestamps: true }
);

automationScriptSchema.index({ automationConfigId: 1, status: 1 });
automationScriptSchema.index({ automationConfigId: 1, order: 1 });
automationScriptSchema.index({ sourceUploadId: 1, sourcePageNumber: 1 });

export const AutomationScript = mongoose.model('AutomationScript', automationScriptSchema);
