import mongoose from 'mongoose';
import { IAutomationHistory } from '../types';
import './define-getters';

const automationHistorySchema = new mongoose.Schema<IAutomationHistory>(
  {
    userId: {
      type: String,
      required: true
    },
    channelId: {
      type: String,
      required: true
    },
    theme: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    script: {
      type: String,
      required: true
    },
    scheduledAt: Date
  },
  { timestamps: true }
);

// Compound indexes for efficient querying
automationHistorySchema.index({ userId: 1, channelId: 1, theme: 1, createdAt: -1 });
automationHistorySchema.index({ channelId: 1, theme: 1, createdAt: -1 });
automationHistorySchema.index({ status: 1, createdAt: -1 });

export const AutomationHistory = mongoose.model('AutomationHistory', automationHistorySchema);
