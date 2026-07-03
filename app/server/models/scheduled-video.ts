import mongoose from 'mongoose';

const scheduledVideoSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true },
    content: {
      theme: String,
      timeOfDay: String,
      script: String,
      title: String,
      description: String,
      tags: [String],
      voiceType: String,
      duration: Number,
      publishTime: Date,
      channelId: String,
      authUserId: String
    },
    status: {
      type: String,
      enum: ['PENDING', 'UPLOADED', 'FAILED'],
      default: 'PENDING'
    },
    retryCount: { type: Number, default: 0 },
    exportId: String,
    error: String
  },
  { timestamps: true }
);

export const ScheduledVideo = mongoose.model('ScheduledVideo', scheduledVideoSchema);
