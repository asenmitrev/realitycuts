import { useUserStatsContext } from '../contexts/userStats';
import { useFirstVideo } from './useFirstVideo';
import { getRedirectPath } from '../utils/redirectLogic';

export const useOnboardingRedirect = () => {
  const { userStats, isLoading: statsLoading, error: statsError } = useUserStatsContext();

  // Determine if we need to fetch the first video
  const redirectResult = userStats ? getRedirectPath(userStats) : null;
  const needsFirstVideo = redirectResult?.path === 'FETCH_FIRST_VIDEO';

  const { data: firstVideo, isLoading: videoLoading, error: videoError } = useFirstVideo(needsFirstVideo);

  // Calculate final redirect path
  const getRedirectInfo = () => {
    if (!redirectResult || !redirectResult.shouldRedirect) {
      return { shouldRedirect: false };
    }

    if (redirectResult.path === 'FETCH_FIRST_VIDEO') {
      if (videoLoading) {
        return { shouldRedirect: false, isLoading: true };
      }
      if (videoError || !firstVideo) {
        return { shouldRedirect: false, error: 'Failed to fetch first video' };
      }
      return {
        shouldRedirect: false
      };
    }

    return {
      shouldRedirect: true,
      path: redirectResult.path
    };
  };

  const redirectInfo = getRedirectInfo();

  return {
    ...redirectInfo,
    isLoading: statsLoading || (needsFirstVideo && videoLoading),
    error: statsError || videoError || redirectInfo.error,
    userStats
  };
};
