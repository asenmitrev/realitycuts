import mongoose from 'mongoose';
import { IUserProfile, IUserProfileWithMethods } from '../types';
import { entitlementMap } from 'shared/config/pricingMap';
import {
  getAutomationLimits,
  AutomationLimits,
  canCreateAutomation,
  getRemainingAutomationSlots
} from 'shared/utils/automation';
import { S3Upload } from './s3-upload';
import './define-getters';
const userProfileSchema = new mongoose.Schema<IUserProfile, {}, IUserProfileWithMethods>(
  {
    firebaseId: {
      type: String,
      required: true,
      index: true,
      unique: true
    },
    firstName: String,
    lastName: String,
    role: {
      type: String,
      enum: ['editor', 'admin', 'user', 'pankeik'],
      default: 'user' // User is the default assigned role
    },
    entitlements: [
      {
        id: String,
        name: String
      }
    ],
    usage: {
      libraryMinutesSpent: {
        type: Number,
        default: 0
      },
      ttsMinutesSpent: {
        type: Number,
        default: 0
      },
      gbStorage: {
        type: Number,
        default: 0
      },
      chatCreditsSpent: {
        type: Number,
        default: 0
      }
    },
    isAdmin: {
      type: Boolean
    },
    isAnonymous: {
      type: Boolean,
      default: false
    },
    excludeFromAnalytics: {
      type: Boolean,
      default: false
    },
    emailPreferences: {
      email: Boolean,
      sms: Boolean
    },
    lastLimitReset: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

userProfileSchema.methods.getTTSMinutesRemaining = function (this: IUserProfile): number {
  const entitlementLimit = (this.entitlements ?? []).reduce((acc, e) => {
    if (e.name.startsWith('tts-')) {
      const minutes = entitlementMap[e.name as keyof typeof entitlementMap]?.limit ?? 0;
      return acc < minutes ? minutes : acc;
    }
    return acc;
  }, 0);

  const usedMinutes = this.usage?.ttsMinutesSpent || 0;

  return Math.max(0, Math.max(entitlementLimit, 2) - usedMinutes);
};

userProfileSchema.methods.getLibraryMinutesRemaining = function (this: IUserProfile): number {
  const entitlementLimit = (this.entitlements ?? []).reduce((acc, e) => {
    if (e.name.startsWith('library-')) {
      const minutes = entitlementMap[e.name as keyof typeof entitlementMap]?.limit ?? 0;
      return acc < minutes ? minutes : acc;
    }
    return acc;
  }, 0);

  const usedMinutes = this.usage?.libraryMinutesSpent || 0;

  return Math.max(0, entitlementLimit - usedMinutes);
};

userProfileSchema.methods.getStorageGbRemaining = async function (this: IUserProfile): Promise<number> {
  const entitlementLimit = (this.entitlements ?? []).reduce((acc, e) => {
    if (e.name.startsWith('storage-')) {
      const gb = entitlementMap[e.name as keyof typeof entitlementMap]?.limit ?? 0;
      return acc < gb ? gb : acc;
    }
    return acc;
  }, 0);

  const uploads = await S3Upload.find({
    userId: this.firebaseId,
    uploadStatus: 'PROCESSED',
    $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }]
  });
  const usedBytes = uploads.reduce((acc, upload) => acc + upload.fileSize, 0);
  const usedGb = usedBytes / 1024 / 1024 / 1024;

  return Math.max(0, entitlementLimit - usedGb);
};

userProfileSchema.methods.getChatCreditsRemaining = function (this: IUserProfile): number {
  const entitlementLimit = (this.entitlements ?? []).reduce((acc, e) => {
    if (e.name.startsWith('chat-credits-')) {
      const credits = entitlementMap[e.name as keyof typeof entitlementMap]?.limit ?? 0;
      return acc < credits ? credits : acc;
    }
    return acc;
  }, 0);

  const usedCredits = this.usage?.chatCreditsSpent || 0;

  // Default to 50 credits if no entitlement is set (free users)
  return Math.max(0, Math.max(entitlementLimit, 50) - usedCredits);
};

userProfileSchema.methods.getAutomationLimits = function (this: IUserProfile): AutomationLimits {
  return getAutomationLimits(this.entitlements ?? []);
};

userProfileSchema.methods.canCreateAutomation = function (
  this: IUserProfile,
  existingCounts: { daily: number; weekly: number },
  scheduleType: 'DAILY' | 'WEEKLY'
): boolean {
  return canCreateAutomation(this.entitlements ?? [], existingCounts, scheduleType);
};

userProfileSchema.methods.getRemainingAutomationSlots = function (
  this: IUserProfile,
  existingCounts: { daily: number; weekly: number }
): AutomationLimits {
  return getRemainingAutomationSlots(this.entitlements ?? [], existingCounts);
};

export const UserProfile = mongoose.model('UserProfile', userProfileSchema);
