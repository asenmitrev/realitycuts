import { FC } from 'react';
import { Navigate } from 'react-router-dom';

export const Root: FC = () => {
  return <Navigate to="/videos" />;
};
