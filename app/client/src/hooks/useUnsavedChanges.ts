import { useEffect, useState } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { useConfirmDialogV2 } from './useConfirmDialog';

export const useUnsavedChanges = (hasUnsavedChanges: boolean) => {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const { dialogContent, awaitConfirmation } = useConfirmDialogV2({
    title: 'You have unsaved changes. You will lose them if you leave this page.',
    type: 'confirm',
    confirmText: 'Leave',
    cancelText: 'Stay'
  });

  // Handle browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Block navigation when there are unsaved changes
  const blocker = useBlocker(hasUnsavedChanges);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const handleBlockedNavigation = async () => {
        try {
          await awaitConfirmation();
          blocker.proceed();
        } catch {
          blocker.reset();
        }
      };
      handleBlockedNavigation();
    }
  }, [blocker, awaitConfirmation]);

  const handleNavigation = async (to: string) => {
    if (hasUnsavedChanges) {
      try {
        await awaitConfirmation();
        setIsNavigating(true);
        navigate(to);
      } catch {
        // User cancelled navigation
      }
    } else {
      navigate(to);
    }
  };

  return {
    handleNavigation,
    dialogContent,
    isNavigating
  };
};
