import mongoose from 'mongoose';
import './define-getters';
import { IAutomationConfig } from '../types';
import { ENVIRONMENT } from '../config/const';

const automationConfigSchema = new mongoose.Schema<IAutomationConfig>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    isEnabled: {
      type: Boolean,
      default: true
    },
    environment: {
      type: String,
      default: ENVIRONMENT || 'uat',
      index: true
    },
    // Simple scheduling - either daily or weekly
    schedule: {
      type: {
        type: String,
        enum: ['DAILY', 'WEEKLY'],
        default: 'DAILY'
      },
      // For daily: times to run each day
      dailyTimes: [
        {
          hour: Number,
          minute: Number,
          label: String // 'morning', 'afternoon', 'evening'
        }
      ],
      // For weekly: which days and what time
      weeklyDays: [Number], // 0-6 (Sunday-Saturday)
      weeklyTime: {
        hour: Number,
        minute: Number
      }
    },
    contentSettings: {
      theme: String,
      voiceId: String,
      isVoicePremium: Boolean,
      privateLibraryIds: [String],
      publicLibraryIds: [String],
      allPublicLibrariesSelected: Boolean,
      pexels: Boolean,
      isPublic: { type: Boolean, default: true },
      captionPreset: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      },
      brandWatermarkUploadId: { type: String },
      brandWatermarkPosition: {
        type: String,
        enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']
      },
      hashtags: { type: String },
      includeMusic: { type: Boolean, default: false },
      musicPrompt: { type: String },
      orientation: {
        type: String,
        enum: ['horizontal', 'vertical'],
        default: 'vertical'
      },
      generateThumbnail: { type: Boolean, default: false },
      sources: [
        {
          uploadId: { type: String },
          fileUrl: { type: String },
          fileName: { type: String },
          status: {
            type: String,
            enum: ['idle', 'processing', 'completed', 'failed'],
            default: 'idle'
          },
          totalPages: { type: Number, default: 0 },
          processedPages: { type: Number, default: 0 },
          totalChapters: { type: Number, default: 0 },
          processedChapters: { type: Number, default: 0 },
          scriptCount: { type: Number, default: 0 },
          error: { type: String },
          isDeleted: { type: Boolean, default: false },
          deletedAt: { type: Date }
        }
      ]
    },
    lastProcessed: {
      type: Date,
      default: null
    },
    processedTimeSlots: {
      type: Map,
      of: Date,
      default: new Map()
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'PAUSED'],
      default: 'ACTIVE'
    }
  },
  { timestamps: true }
);

// Indexes for efficient querying
automationConfigSchema.index({ isEnabled: 1, status: 1 });
automationConfigSchema.index({ lastProcessed: 1 });
automationConfigSchema.index({ environment: 1, isEnabled: 1, status: 1 });

export const AutomationConfig = mongoose.model('AutomationConfig', automationConfigSchema);
