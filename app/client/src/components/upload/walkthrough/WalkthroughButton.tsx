import type React from 'react';
import { Button, type ButtonProps, Tooltip } from '@chakra-ui/react';
import { FaQuestionCircle } from 'react-icons/fa';
import { useWalkthrough } from './WalkthroughProvider';
import {
  addToLibraryWalkthrough,
  facelessAIVideoWalkthrough,
  libraryListWalkthrough,
  videoListWalkthrough
} from './walkthroughs';
import { useCallback, useEffect } from 'react';

interface WalkthroughButtonProps extends ButtonProps {
  isSample?: boolean;
  walkthroughType?: 'facelessAIVideo' | 'addToLibrary' | 'libraryList' | 'videoList' | string;
}

export const WalkthroughButton: React.FC<WalkthroughButtonProps> = ({
  walkthroughType = 'facelessAIVideo',
  isSample,
  ...props
}) => {
  const { startWalkthrough } = useWalkthrough();

  const handleStartWalkthrough = useCallback(() => {
    switch (walkthroughType) {
      case 'facelessAIVideo':
        startWalkthrough(facelessAIVideoWalkthrough);
        break;
      case 'addToLibrary':
        startWalkthrough(addToLibraryWalkthrough);
        break;
      case 'libraryList':
        startWalkthrough(libraryListWalkthrough);
        break;
      case 'videoList':
        startWalkthrough(videoListWalkthrough);
        break;
      default:
        console.warn(`Walkthrough type "${walkthroughType}" not found`);
    }
  }, [walkthroughType, startWalkthrough]);

  useEffect(() => {
    if (isSample) {
      const timeoutId = setTimeout(() => {
        handleStartWalkthrough();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [isSample, handleStartWalkthrough]);

  return (
    <Tooltip label="Start walkthrough">
      <Button leftIcon={<FaQuestionCircle />} onClick={handleStartWalkthrough} variant="outline" size="sm" {...props}>
        Help
      </Button>
    </Tooltip>
  );
};
