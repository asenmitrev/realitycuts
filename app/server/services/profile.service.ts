import { UserProfileRepository } from '../repositories/user-profile.repository';
import { WaitlistRepository } from '../repositories/waitlist.repository';
import { UnauthorizedError } from '../errors';
import { getElevenLabsVoices } from './ai/elevenlabs';
import { getUserIdFromEmail, getUserEmail } from './auth';
import { StorageService } from './storage.service';
import { ElevenLabsVoice, IUserProfile } from '../types/index';
import libraryRepository from '../repositories/library.repository';
import videoAIDataRepository from '../repositories/video-ai-data.repository';
import exportRepository from '../repositories/export.repository';
import automationConfigRepository from '../repositories/automation-config.repository';
import { logger } from './logging';
export class ProfileService {
  private userProfileRepository: UserProfileRepository;
  private waitlistRepository: WaitlistRepository;
  private storageService: StorageService;

  constructor() {
    this.userProfileRepository = new UserProfileRepository();
    this.waitlistRepository = new WaitlistRepository();
    this.storageService = new StorageService();
  }

  async handleAfterLogin(
    firebaseId: string,
    firstName?: string,
    lastName?: string,
    email?: string
  ): Promise<{ message: string }> {
    // Check if user profile already exists
    const existingProfile = await this.userProfileRepository.findByFirebaseIdPlain(firebaseId);

    if (existingProfile) {
      // User exists, return success without saving
      return { message: 'User profile found.' };
    }

    // User doesn't exist, create a new profile
    await this.userProfileRepository.create({
      firebaseId,
      firstName: firstName || '', // Provide default if firstName is missing
      lastName: lastName || '' // Provide default if lastName is missing
    });

    // Option A: No Stripe free trial needed — all users have full access
    return { message: 'User profile created successfully.' };
  }

  /** Free entitlements for anonymous users (no Stripe). Same as free trial in payment.service. */
  private static readonly ANONYMOUS_FREE_ENTITLEMENTS: IUserProfile['entitlements'] = [
    { id: 'tts-2', name: 'tts-2' },
    { id: 'library-10', name: 'library-10' },
    { id: 'storage-2', name: 'storage-2' },
    { id: 'chat-credits-50', name: 'chat-credits-50' }
  ];

  /**
   * Create or return profile for an anonymous Firebase user. Idempotent.
   * Assigns free entitlements without creating a Stripe customer.
   */
  async handleAnonymousSetup(firebaseId: string): Promise<{ profile: any }> {
    const existing = await this.userProfileRepository.findByFirebaseIdPlain(firebaseId);
    if (existing) {
      return { profile: existing };
    }
    const profile = await this.userProfileRepository.create({
      firebaseId,
      firstName: '',
      lastName: '',
      isAnonymous: true,
      entitlements: ProfileService.ANONYMOUS_FREE_ENTITLEMENTS
    });
    logger.info('Anonymous user profile created', { 'User ID': firebaseId });
    return { profile };
  }

  async handleAfterRegistration(
    firebaseId: string,
    firstName?: string,
    lastName?: string,
    referralCode?: string
  ): Promise<{ message: string }> {
    const existingProfile = await this.userProfileRepository.findByFirebaseId(firebaseId);

    if (existingProfile?.isAnonymous) {
      // Upgrade anonymous account to registered: same uid, now with email and Stripe
      await this.userProfileRepository.updateByFirebaseId(firebaseId, {
        isAnonymous: false,
        firstName: firstName ?? existingProfile.firstName ?? '',
        lastName: lastName ?? existingProfile.lastName ?? ''
      });
    } else if (!existingProfile) {
      // New user (no existing profile): create from scratch
      await this.userProfileRepository.create({
        firebaseId,
        firstName: firstName || '',
        lastName: lastName || ''
      });
    }

    // Option A: No Stripe free trial needed — all users have full access
    return { message: 'User profile created successfully.' };
  }

  async checkSignupAvailability(): Promise<{ cr: boolean }> {
    const userProfileCount = await this.userProfileRepository.countDocuments();
    return { cr: userProfileCount <= 15000 };
  }

  async addToWaitlist(email: string): Promise<{ message: string }> {
    const result = await this.waitlistRepository.addToWaitlist(email);
    return { message: result.message };
  }

  async getUserProfile(firebaseId: string): Promise<any> {
    // Fetch the user profile from the database
    const userProfile = await this.userProfileRepository.findByFirebaseIdPlain(firebaseId);

    if (!userProfile) {
      // User not found
      throw new UnauthorizedError('User profile not found.');
    }

    const storageUsed = await this.storageService.getUserStorageUsed(firebaseId);

    // Return the user profile data with storage usage
    return {
      ...userProfile,
      usage: {
        ...userProfile.usage,
        gbStorage: storageUsed
      }
    };
  }

  async unsubscribeFromEmails(email: string): Promise<{ success: boolean }> {
    const userId = await getUserIdFromEmail(email);
    await this.userProfileRepository.updateByFirebaseId(userId, {
      emailPreferences: { email: false, sms: false }
    });

    return { success: true };
  }

  async getPremiumVoices(): Promise<ElevenLabsVoice[]> {
    return getElevenLabsVoices();
  }

  async getUserEmail(userId: string): Promise<string | undefined> {
    return await getUserEmail(userId);
  }

  async getUserStats(userId: string): Promise<{
    libraries: number;
    videos: number;
    exports: number;
    automations: number;
  }> {
    const [libraries, videos, exports, automations] = await Promise.all([
      libraryRepository.getNonNewLibraryCount(userId),
      videoAIDataRepository.getVideoCount(userId),
      exportRepository.getCompletedExportCount(userId),
      automationConfigRepository.getAutomationCount(userId)
    ]);

    return {
      libraries,
      videos,
      exports,
      automations
    };
  }
}

export default new ProfileService();
