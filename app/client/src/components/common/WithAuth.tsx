import { FC, PropsWithChildren, useEffect, useState } from 'react';
import { useAuthUser, useIsAuthInitializing } from '../../contexts/auth/hooks';
import { useNavigate } from 'react-router-dom';
import { ProfileProvider } from '../../contexts/profile/Provider';

export const WithAuth: FC<PropsWithChildren> = ({ children }) => {
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);

  const user = useAuthUser();
  const authInitializing = useIsAuthInitializing();

  useEffect(() => {
    if (authInitializing) return;
    setIsInitializing(false);

    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, authInitializing, navigate]);

  if (isInitializing) return null;
  if (!user) return null;

  return <ProfileProvider>{children}</ProfileProvider>;
};
