import { Response, NextFunction } from 'express';
import { UserProfile } from '../models/user-profile';
import { AuthenticatedRequest, UserRole } from '../types';

export const restrictRoleAccess =
  (roles: UserRole[]) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.user_id) {
      return res.status(401).json({ message: 'Profile not found: no user in request.' });
    }
    const firebaseId = req.user.user_id;
    // Fetch the user profile from the database
    const userProfile = await UserProfile.findOne({ firebaseId });
    if (!userProfile) {
      return res.status(404).json({ message: 'User profile not found.' });
    }
    if (roles.indexOf(userProfile.role) !== -1) {
      next();
    } else {
      return res.status(404).json({ message: 'You are unauthorized to use this route.' });
    }
  };
