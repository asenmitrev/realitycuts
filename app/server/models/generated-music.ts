import mongoose from 'mongoose';
import { IGeneratedMusic } from '../types';
import './define-getters';

const generatedMusicSchema = new mongoose.Schema<IGeneratedMusic>(
  {
    userId: { type: String, index: true },
    url: { type: String, required: true },
    duration: { type: Number, required: true },
    prompt: { type: String, required: true },
    reasoning: String,
    videoType: String,
    estimatedMood: String,
    confidence: Number,
    filename: { type: String, required: true },
    fileSize: { type: Number, required: true },
    usageCount: { type: Number, default: 0 },
    elevenlabsMetadata: Object,
    elevenlabsCompositionPlan: Object
  },
  { timestamps: true }
);

// Add indexes for better query performance
generatedMusicSchema.index({ userId: 1, createdAt: -1 });
generatedMusicSchema.index({ prompt: 'text', title: 'text' });

export const GeneratedMusic = mongoose.model('GeneratedMusic', generatedMusicSchema);
