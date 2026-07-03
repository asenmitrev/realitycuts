import { useUserId } from '../contexts/firebase/hooks';

export const useOnboardingSkipped = () => {
  const userId = useUserId();
  const hasSkippedOnboarding = localStorage.getItem('onboardingSkipped' + userId) === 'true';

  return hasSkippedOnboarding;
};
