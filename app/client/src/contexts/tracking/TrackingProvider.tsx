import { usePageTracking } from '../../hooks/usePageTracking';

export const TrackingProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  usePageTracking();

  return children;
};
