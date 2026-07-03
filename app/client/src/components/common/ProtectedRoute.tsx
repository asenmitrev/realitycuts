import React from 'react';
import { useOnboardingRedirect } from '../../hooks/useOnboardingRedirect';
import { GlobalSpinner } from './GlobalSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const {
    isLoading: redirectLoading,
    error: redirectError
  } = useOnboardingRedirect();

  // Show loading spinner while checking redirect logic
  if (redirectLoading) {
    return <GlobalSpinner />;
  }

  // If there's an error with redirect logic, log it but don't block the user
  if (redirectError) {
    console.error('Error in onboarding redirect logic:', redirectError);
  }

  return <>{children}</>;
};
