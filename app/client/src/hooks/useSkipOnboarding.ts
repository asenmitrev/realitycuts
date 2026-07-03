import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserId } from '../contexts/firebase/hooks';

export const useSkipOnboarding = () => {
  const userId = useUserId();
  const navigate = useNavigate();

  const skipOnboarding = useCallback(
    (promptToken?: string) => {
      localStorage.setItem('onboardingSkipped' + userId, 'true');
      if (promptToken) {
        navigate(`/preuser-prompt?prompt_token=${promptToken}`);
      } else {
        navigate('/');
      }
    },
    [userId, navigate]
  );

  return skipOnboarding;
};
