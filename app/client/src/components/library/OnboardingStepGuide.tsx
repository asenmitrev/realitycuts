import React from 'react';
import { Box, Text, Flex } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { FaCloudUploadAlt, FaCog, FaCheckCircle } from 'react-icons/fa';

interface StepGuideProps {
  currentStep: number;
}

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Upload Media',
    description: 'Add your content',
    icon: FaCloudUploadAlt
  },
  {
    number: 2,
    title: 'Processing',
    description: "We're working on it",
    icon: FaCog
  },
  {
    number: 3,
    title: 'Review',
    description: 'Check your video',
    icon: FaCheckCircle
  }
];

const pulseAnimation = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
`;

const glowAnimation = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(236, 137, 51, 0.4), 0 0 40px rgba(236, 137, 51, 0.2); }
  50% { box-shadow: 0 0 30px rgba(236, 137, 51, 0.6), 0 0 60px rgba(236, 137, 51, 0.3); }
`;

export const OnboardingStepGuide: React.FC<StepGuideProps> = ({ currentStep }) => {
  return (
    <Box py={8} px={4}>
      <Flex justifyContent="center" alignItems="center" position="relative" maxW="600px" mx="auto">
        {steps.map((step, index) => {
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          const isPending = step.number > currentStep;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.number}>
              {/* Connector Line */}
              {index > 0 && (
                <Box flex="1" h="3px" mx={-2} position="relative" overflow="hidden" borderRadius="full">
                  <Box position="absolute" inset={0} bg="whiteAlpha.100" />
                  <Box
                    position="absolute"
                    inset={0}
                    bg={isCompleted || isActive ? 'linear-gradient(90deg, #ec8933, #f6a355)' : 'transparent'}
                    transition="all 0.5s ease"
                    transform={isCompleted ? 'scaleX(1)' : isActive ? 'scaleX(0.5)' : 'scaleX(0)'}
                    transformOrigin="left"
                  />
                </Box>
              )}

              {/* Step Circle */}
              <Flex direction="column" alignItems="center" position="relative" zIndex={1}>
                <Box position="relative" mb={4}>
                  {/* Background glow for active step */}
                  {isActive && (
                    <Box
                      position="absolute"
                      inset={-2}
                      borderRadius="full"
                      bg="radial-gradient(circle, rgba(236, 137, 51, 0.3) 0%, transparent 70%)"
                      animation={`${glowAnimation} 2s ease-in-out infinite`}
                    />
                  )}

                  {/* Main circle */}
                  <Flex
                    w="56px"
                    h="56px"
                    borderRadius="full"
                    alignItems="center"
                    justifyContent="center"
                    position="relative"
                    bg={
                      isActive
                        ? 'linear-gradient(135deg, #ec8933 0%, #f6a355 100%)'
                        : isCompleted
                        ? 'linear-gradient(135deg, #2FDF8C 0%, #22c07a 100%)'
                        : 'whiteAlpha.100'
                    }
                    border="2px solid"
                    borderColor={isActive ? 'transparent' : isCompleted ? 'transparent' : 'whiteAlpha.200'}
                    transition="all 0.3s ease"
                    animation={isActive ? `${pulseAnimation} 2s ease-in-out infinite` : undefined}
                    _hover={{
                      transform: 'scale(1.05)'
                    }}
                  >
                    <Icon size={22} color={isPending ? '#6b7280' : 'white'} />
                  </Flex>
                </Box>

                {/* Step text */}
                <Box textAlign="center" minW="100px">
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    color={isActive ? 'white' : isCompleted ? '#2FDF8C' : 'gray.500'}
                    mb={1}
                    transition="color 0.3s ease"
                    letterSpacing="0.02em"
                  >
                    {step.title}
                  </Text>
                  <Text fontSize="xs" color={isActive ? 'gray.300' : 'gray.600'} transition="color 0.3s ease">
                    {step.description}
                  </Text>
                </Box>
              </Flex>
            </React.Fragment>
          );
        })}
      </Flex>
    </Box>
  );
};
