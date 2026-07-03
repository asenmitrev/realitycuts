import { FC, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * This page is no longer used — Firebase email-link sign-in has been replaced
 * with simple email/password auth. This component redirects to /login.
 */
export const CompleteSignIn: FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return null;
};
