import { useContext } from 'react';
import { ProfileContext } from './context';

export const useProfile = () => {
  const { profile } = useContext(ProfileContext);

  return profile;
};
export const useIsPlus = () => true; // Option A: all users are premium

export const useIsFree = () => false; // Option A: no free-tier restrictions
export const useRole = () => {
  const ctx = useContext(ProfileContext);
  return ctx.role;
};

export const useRefetchProfile = () => {
  const ctx = useContext(ProfileContext);
  return ctx.refetchProfile;
};
