import { UserStats } from '../hooks/useUserStats';

export interface RedirectResult {
  shouldRedirect: boolean;
  path?: string;
}

/**
 * Determines where to redirect user based on their stats
 *
 * Rules:
 * - 0 videos, 0 libraries -> /library/add?onboarding=true
 * - 0 videos, 1+ libraries -> /library/processing
 * - 1 videos, 1+ libraries, 0 exports -> /videos/:videoId?onboarding=true (need to fetch first video)
 * - 1 videos, 1+ libraries, 1+ exports, 0 automations -> /onboarding/connect-channels
 * - 1+ videos, 1+ libraries, 1+ exports or automations -> /automation-configs
 */
export const getRedirectPath = (stats: UserStats): RedirectResult => {
  const { libraries, videos, exports, automations } = stats;

  // 0 videos, 0 libraries -> /library/add?onboarding=true
  if (videos === 0 && libraries === 0) {
    return {
      shouldRedirect: true,
      path: '/library/add?onboarding=true'
    };
  }

  // 0 videos, 1+ libraries -> /library/processing
  if (videos === 0 && libraries >= 1) {
    return {
      shouldRedirect: true,
      path: '/library/processing'
    };
  }

  // 1 videos, 1+ libraries, 0 exports -> /videos/:videoId?onboarding=true
  if (videos === 1 && libraries >= 1 && exports === 0) {
    return {
      shouldRedirect: true,
      path: 'FETCH_FIRST_VIDEO' // Special flag to indicate we need to fetch the video ID
    };
  }

  // 1 videos, 1+ libraries, 1+ exports, 0 automations -> /onboarding/connect-channels
  // if (videos === 1 && libraries >= 1 && exports >= 1 && automations === 0) {
  //   return {
  //     shouldRedirect: true,
  //     path: '/onboarding/connect-channels'
  //   };
  // }

  // 1+ videos, libraries, exports or automations -> /automation-configs
  if (videos >= 1 && libraries >= 1 && (exports >= 1 || automations >= 1)) {
    return {
      shouldRedirect: false
    };
  }

  // No redirect needed
  return {
    shouldRedirect: false
  };
};
