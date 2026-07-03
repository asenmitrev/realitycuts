import { Response, Request } from 'express';
import profileService from '../services/profile.service';
import { AuthenticatedRequest } from '../types';
import { IUserProfileRequest } from '../types/index';
import { logger } from '../services/logging';
import { configureDotenv } from '../config/dotenv';
import { BadRequestError } from '../errors';
configureDotenv();

export default {
  afterLogin: async (req: IUserProfileRequest, res: Response) => {
    const { firebaseId, email, firstName, lastName } = req.body;

    logger.info('User logged in', {
      'User ID': firebaseId
    });

    const result = await profileService.handleAfterLogin(firebaseId, firstName, lastName, email);
    res.json(result);
  },

  afterReg: async (req: IUserProfileRequest, res: Response) => {
    const { firebaseId, firstName, lastName, referralCode } = req.body;

    logger.info('Creating new user profile', {
      'User ID': firebaseId
    });

    const result = await profileService.handleAfterRegistration(firebaseId, firstName, lastName, referralCode);
    res.json(result);
  },

  cr: async (req: Request, res: Response) => {
    const result = await profileService.checkSignupAvailability();
    res.json(result);
  },

  waitlist: async (req: Request, res: Response) => {
    const { email } = req.body;

    const result = await profileService.addToWaitlist(email);
    res.json(result);
  },

  anonymousSetup: async (req: AuthenticatedRequest, res: Response) => {
    const firebaseId = (req.user as any)?.uid ?? req.user!.user_id;
    if (!firebaseId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await profileService.handleAnonymousSetup(firebaseId);
    res.json(result);
  },

  profile: async (req: AuthenticatedRequest, res: Response) => {
    const firebaseId = (req.user as any)?.uid ?? req.user!.user_id;

    const userProfile = await profileService.getUserProfile(firebaseId);
    res.json(userProfile);
  },

  userStats: async (req: AuthenticatedRequest, res: Response) => {
    const userId = (req.user as any)?.uid ?? req.user!.user_id;

    const stats = await profileService.getUserStats(userId);
    res.json(stats);
  },

  unsubscribe: async (req: Request, res: Response) => {
    const { email } = req.body;

    const result = await profileService.unsubscribeFromEmails(email);
    res.json(result);
  },

  premiumVoices: async (req: Request, res: Response) => {
    const voices = await profileService.getPremiumVoices();
    res.json(voices);
  },

  getUserEmail: async (req: Request, res: Response) => {
    const { userId } = req.params;
    if (!userId || process.env.ENVIRONMENT !== 'uat') {
      throw new BadRequestError('User ID is required');
    }
    const email = await profileService.getUserEmail(userId);
    res.json({ email });
  }
};
