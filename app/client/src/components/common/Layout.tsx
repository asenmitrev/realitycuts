import { FC, PropsWithChildren } from 'react';
import NavBar from '../navbar/NavBar';
import { TrackingProvider } from '../../contexts/tracking/TrackingProvider';
import { Outlet } from 'react-router-dom';

export const Layout: FC<PropsWithChildren> = () => {
  return (
    <>
      <NavBar></NavBar>
      <TrackingProvider>
        <Outlet />
      </TrackingProvider>
    </>
  );
};
