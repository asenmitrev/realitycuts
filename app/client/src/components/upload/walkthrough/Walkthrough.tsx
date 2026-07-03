import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Button, Flex, Heading, Text, VStack, HStack, IconButton, Progress } from '@chakra-ui/react';
import { FaArrowRight, FaArrowLeft, FaTimes } from 'react-icons/fa';

export interface WalkthroughStep {
  title: string;
  description: string;
  elementSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface WalkthroughProps {
  steps: WalkthroughStep[];
  isOpen: boolean;
  onClose: () => void;
}

export const Walkthrough: React.FC<WalkthroughProps> = ({ steps, isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [elementPosition, setElementPosition] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  useEffect(() => {
    if (isOpen && steps[currentStep]) {
      const updatePosition = () => {
        const element = document.querySelector(steps[currentStep].elementSelector);

        if (element) {
          const rect = element.getBoundingClientRect();
          setElementPosition(rect);

          // Scroll element into view with smooth behavior
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });

          // Calculate tooltip position based on the step's position preference
          const position = steps[currentStep].position;
          const spacing = 20; // Space between element and tooltip

          const style: React.CSSProperties = {
            position: 'fixed',
            zIndex: 1500,
            maxWidth: '300px'
          };

          switch (position) {
            case 'top':
              style.bottom = `${window.innerHeight - rect.top + spacing}px`;
              style.left = `${rect.left + rect.width / 2 - 150}px`;
              break;
            case 'bottom':
              style.top = `${rect.bottom + spacing}px`;
              style.left = `${rect.left + rect.width / 2 - 150}px`;
              break;
            case 'left':
              style.top = `${rect.top + rect.height / 2 - 100}px`;
              style.right = `${window.innerWidth - rect.left + spacing}px`;
              break;
            case 'right':
              style.top = `${rect.top + rect.height / 2 - 100}px`;
              style.left = `${rect.right + spacing}px`;
              break;
          }

          setTooltipStyle(style);
        }
      };

      // Initial position update
      updatePosition();

      // Add scroll event listener
      window.addEventListener('scroll', updatePosition, true);

      // Clean up the event listener
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [currentStep, isOpen, steps]);
  if (!isOpen || !steps.length) return null;

  return (
    <>
      {/* Semi-transparent overlay */}
      <Box
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        bg="blackAlpha.700"
        zIndex="overlay"
        onClick={e => e.stopPropagation()}
      />

      {/* Highlight for the current element */}
      {elementPosition && (
        <Box
          position="fixed"
          top={`${elementPosition.top - 4}px`}
          left={`${elementPosition.left - 4}px`}
          width={`${elementPosition.width + 8}px`}
          height={`${elementPosition.height + 8}px`}
          border="2px solid"
          borderColor="whiteAlpha.200"
          borderRadius="md"
          zIndex="tooltip"
          pointerEvents="none"
          animation="pulse 2s infinite"
          sx={{
            '@keyframes pulse': {
              '0%': {
                boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.4)'
              },
              '70%': {
                boxShadow: '0 0 0 10px rgba(255, 255, 255, 0)'
              },
              '100%': {
                boxShadow: '0 0 0 0 rgba(255, 255, 255, 0)'
              }
            }
          }}
        />
      )}

      {/* Tooltip */}
      <Box
        bg="gray.800"
        color="white"
        borderRadius="md"
        p={4}
        boxShadow="lg"
        border="1px solid"
        borderColor="gray.200"
        zIndex="popover"
        style={tooltipStyle}
      >
        <VStack align="stretch" spacing={3}>
          <Flex justify="space-between" align="center">
            <Heading size="md" color="whiteAlpha.800">
              {steps[currentStep].title}
            </Heading>
            <IconButton icon={<FaTimes />} aria-label="Close walkthrough" size="sm" variant="ghost" onClick={onClose} />
          </Flex>

          <Text color="whiteAlpha.700">{steps[currentStep].description}</Text>

          <Box pt={2}>
            <Progress
              value={((currentStep + 1) / steps.length) * 100}
              size="xs"
              colorScheme="white"
              mb={3}
              borderRadius="full"
            />

            <Flex justify="space-between">
              <Text fontSize="sm">
                Step {currentStep + 1} of {steps.length}
              </Text>

              <HStack>
                {currentStep > 0 && (
                  <Button leftIcon={<FaArrowLeft />} size="sm" variant="ghost" onClick={handlePrevious}>
                    Previous
                  </Button>
                )}

                <Button
                  rightIcon={currentStep < steps.length - 1 ? <FaArrowRight /> : undefined}
                  size="sm"
                  colorScheme="white"
                  onClick={handleNext}
                >
                  {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
                </Button>
              </HStack>
            </Flex>
          </Box>
        </VStack>
      </Box>
    </>
  );
};
