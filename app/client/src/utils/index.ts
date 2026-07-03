import { IUserProfile } from '../types';

export function secondsToTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds - Math.floor(seconds)) * 1000);

  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
  const formattedMilliseconds = milliseconds.toString().padEnd(3, '0');

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`;
}

export const profileRemainingLibraryMinutes = function (_profile?: IUserProfile): number {
  return Number.POSITIVE_INFINITY; // Option A: unlimited for all users
};
