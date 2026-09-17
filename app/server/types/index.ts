import { Request } from 'express';
import mongoose, { Document } from 'mongoose';
import { TranscriptionJob, ExportJob, CaptionSettings, Alternative } from 'shared/types';

export * from 'shared/types';
export * from './fcpxml';

export type { IVideoAIData } from './video-ai-data';
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    uid: string;
    email?: string;
    role?: string;
    firebase_id?: string;
  };
}

export interface IGetProfileRequest extends Request {
  params: {
    firebaseId: string;
  };
}

export interface IUserProfileRequest extends Request {
  body: {
    firebaseId: string;
    email?: string; // Optional email from client (e.g., from Google sign-in)
    firstName?: string; // Optional for now
    lastName?: string; // Optional for now
    projects?: string[];
    referralCode?: string;
  };
}

export interface ISurvey {
  userId: string;
  userType: 'solo_creator' | 'marketing_professional' | 'business_owner' | 'agency_freelancer' | 'other';
  userTypeOther?: string;
  usageTypes: ('youtube_videos' | 'business_promotion' | 'tiktok_instagram' | 'educational_videos' | 'other')[];
  usageTypesOther?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IExportJob = Omit<Document, '_id'> & ExportJob;

export type IEventMessage = {
  userId: string;
  eventId: string;
  message?: string;
  data: any;
  eventType: 'DATA' | 'MESSAGE';
  progress?: number;
  isError?: boolean;
  expireAt?: Date;
};

export type ITranscriptionJob = TranscriptionJob;

export interface IAutomationConfig extends Document {
  userId: string;
  isEnabled: boolean;
  environment: string;
  schedule: {
    type: 'DAILY' | 'WEEKLY';
    dailyTimes?: {
      hour: number;
      minute: number;
      label?: string;
    }[];
    weeklyDays?: number[]; // 0-6 (Sunday-Saturday)
    weeklyTime?: {
      hour: number;
      minute: number;
    };
  };
  contentSettings: {
    theme?: string;
    voiceId?: string;
    isVoicePremium?: boolean;
    privateLibraryIds?: string[];
    publicLibraryIds?: string[];
    allPublicLibrariesSelected?: boolean;
    pexels?: boolean;
    isPublic?: boolean;
    captionPreset?: CaptionSettings;
    brandWatermarkUploadId?: string;
    brandWatermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    hashtags?: string;
    includeMusic?: boolean;
    musicPrompt?: string;
    orientation?: 'horizontal' | 'vertical';
    generateThumbnail?: boolean; // Generate thumbnail automatically (only for horizontal videos)
    sources?: IAutomationSource[];
  };
  platforms?: {
    youtube?: {
      enabled?: boolean;
      channelId?: string;
      channelName?: string;
    };
  };
  lastProcessed?: Date;
  processedTimeSlots?: Map<string, Date>;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: Date;
  updatedAt: Date;
}

export type AutomationSourceStatus = 'idle' | 'processing' | 'completed' | 'failed';

export interface IAutomationSource {
  uploadId?: string;
  fileUrl?: string;
  fileName?: string;
  status?: AutomationSourceStatus;
  totalPages?: number;
  processedPages?: number;
  totalChapters?: number;
  processedChapters?: number;
  scriptCount?: number;
  error?: string;
  isDeleted?: boolean;
  deletedAt?: Date;
}

export interface IAutomationScript extends Document {
  automationConfigId: mongoose.Types.ObjectId;
  userId: string;
  topic: string;
  script: string;
  sourceUploadId: mongoose.Types.ObjectId;
  sourcePageNumber: number;
  status: 'available' | 'used' | 'deleted';
  usedAt?: Date | null;
  deletedAt?: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAutomationHistory extends Document {
  userId: string;
  channelId: string;
  theme: string;
  title: string;
  script: string;
  voiceId?: string;
  isVoicePremium?: boolean;
  tjId: string;
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITestGenerationRequest {
  theme: string;
  channelId?: string;
  voiceType?: string;
  hashtags?: string;
  isTalkingHead?: boolean;
  includeMusic?: boolean;
  brollDuration?: number;
  useVideoEmbeddings?: boolean;
  privateLibraryIds?: string[];
  publicLibraryIds?: string[];
  isVoicePremium?: boolean;
  size?: '1080p' | '1080x1920';
  language?: string;
  isAllPublicLibrariesSelected?: boolean;
  captions?: CaptionSettings;
  orientation?: 'HORIZONTAL' | 'VERTICAL';
  libraries?: {
    pexels?: boolean;
  };
}

export interface IGeneratedMusic extends Document {
  userId: string;
  url: string;
  title: string;
  duration: number;
  prompt: string;
  reasoning?: string;
  videoType?: string;
  estimatedMood?: string;
  confidence?: number;
  filename: string;
  fileSize: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  elevenlabsMetadata?: any;
  elevenlabsCompositionPlan?: any;
}
export type AltWithBounds = { bounds: number[]; alternative: Alternative; isCompromise?: boolean };
