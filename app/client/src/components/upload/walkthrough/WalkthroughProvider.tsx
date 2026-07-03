'use client';

import type React from 'react';
import { createContext, useContext, useState, type ReactNode, memo, useCallback } from 'react';
import { Walkthrough, type WalkthroughStep } from './Walkthrough';

interface WalkthroughContextType {
  startWalkthrough: (steps: WalkthroughStep[]) => void;
  closeWalkthrough: () => void;
}

const WalkthroughContext = createContext<WalkthroughContextType | undefined>(undefined);

export const useWalkthrough = () => {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider');
  }
  return context;
};

interface WalkthroughProviderProps {
  children: ReactNode;
}

export const WalkthroughProvider: React.FC<WalkthroughProviderProps> = memo(({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState<WalkthroughStep[]>([]);

  const startWalkthrough = useCallback((newSteps: WalkthroughStep[]) => {
    setSteps(newSteps);
    setIsOpen(true);
  }, []);

  const closeWalkthrough = () => {
    setIsOpen(false);
  };

  return (
    <WalkthroughContext.Provider value={{ startWalkthrough, closeWalkthrough }}>
      {children}
      <Walkthrough steps={steps} isOpen={isOpen} onClose={closeWalkthrough} />
    </WalkthroughContext.Provider>
  );
});
