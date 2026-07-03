import mongoose from 'mongoose';
import { ISurvey } from '../types';
import './define-getters';

const surveySchema = new mongoose.Schema<ISurvey>(
  {
    userId: {
      type: String,
      required: true
    },
    userType: {
      type: String,
      enum: ['solo_creator', 'marketing_professional', 'business_owner', 'agency_freelancer', 'other'],
      required: true
    },
    userTypeOther: {
      type: String
    },
    usageTypes: [
      {
        type: String,
        enum: ['youtube_videos', 'business_promotion', 'tiktok_instagram', 'educational_videos', 'other']
      }
    ],
    usageTypesOther: {
      type: String
    }
  },
  { timestamps: true }
);

// Ensure one survey per user
surveySchema.index({ userId: 1 }, { unique: true });

export const Survey = mongoose.model('Survey', surveySchema);
