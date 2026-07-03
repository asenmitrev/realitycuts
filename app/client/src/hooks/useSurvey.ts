import { useState, useEffect } from 'react';
import { useApiService } from './useApiService';
import { useUserId } from '../contexts/firebase/hooks';

interface SurveyStatus {
  hasCompleted: boolean;
}

export const useSurvey = () => {
  const [hasCompletedSurvey, setHasCompletedSurvey] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const apiService = useApiService();
  const userId = useUserId();

  useEffect(() => {
    const checkSurveyStatus = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiService.get<SurveyStatus>('/api/survey/status');
        setHasCompletedSurvey(response.hasCompleted);
      } catch (error) {
        console.error('Error checking survey status:', error);
        setHasCompletedSurvey(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSurveyStatus();
  }, [userId, apiService]);

  const markSurveyCompleted = () => {
    setHasCompletedSurvey(true);
  };

  return {
    hasCompletedSurvey,
    isLoading,
    markSurveyCompleted,
    shouldShowSurvey: hasCompletedSurvey === false
  };
};
