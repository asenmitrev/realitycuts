import { createContext } from 'react';
import { IUserProfile, UserRole } from '../../types';

interface FirebaseContext {
  profile?: IUserProfile;
  refetchProfile: () => void;
  role?: UserRole;
}
export const ProfileContext = createContext<FirebaseContext>({
  profile: undefined,
  refetchProfile: () => null,
  role: undefined
});
