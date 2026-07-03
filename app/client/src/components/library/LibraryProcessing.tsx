import React from 'react';
import { Box, Heading, Text, VStack, Container, useColorModeValue, Button, Flex } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { FaCogs } from 'react-icons/fa';
import { OnboardingStepGuide } from './OnboardingStepGuide';
import { useSkipOnboarding } from '../../hooks/useSkipOnboarding';
import { useLocation } from 'react-router-dom';

const MotionBox = motion.create('div');

export const LibraryProcessing: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const promptToken = searchParams.get('prompt_token');
  
  const bgGradient = useColorModeValue('linear(to-b, gray.900, gray.950)', 'linear(to-b, gray.900, gray.950)');
  const cardBg = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const mutedTextColor = useColorModeValue('gray.400', 'gray.400');
  const skipOnboarding = useSkipOnboarding();

  return (
    <Box py={4}>
      <Container w="100%" maxW={{ base: '100%', md: '1000px' }} pb={10}>
        <Text fontSize="2xl" fontWeight="bold" textAlign="center" mb={6}>
          Welcome to Your Media Library
        </Text>
        <Text fontSize="lg" textAlign="center" mb={8} color="gray.400">
          Let's get your content ready in just a few simple steps
        </Text>

        {/* Step Guide at the top */}
        <OnboardingStepGuide currentStep={2} />

        <Box bg={cardBg} borderRadius="md" overflow="hidden" borderColor="whiteAlpha.200" borderWidth={1}>
          <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Box borderRadius="lg" overflow="hidden" bgGradient={bgGradient} boxShadow="xl">
              <VStack spacing={8} align="stretch" py={16} px={8}>
                <MotionBox
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
                >
                  <Box
                    mx="auto"
                    w={20}
                    h={20}
                    borderRadius="full"
                    bg="blue.500"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <MotionBox animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                      <FaCogs size={40} color="white" />
                    </MotionBox>
                  </Box>
                </MotionBox>

                <VStack spacing={4} textAlign="center">
                  <Heading as="h1" size="xl" fontWeight="bold" letterSpacing="tight">
                    Library Processing
                  </Heading>
                  <Text color={mutedTextColor} maxW="md" mx="auto">
                    We're analyzing and processing your content. This can take up to 45 minutes.
                  </Text>
                </VStack>

                <Box bg="blue.900" borderRadius="md" p={4} borderColor="blue.700" borderWidth={1}>
                  <VStack spacing={2}>
                    <Text fontSize="sm" color={mutedTextColor} textAlign="center">
                      Once processing is complete, we'll send you an email with a sample video. You can close this page.
                    </Text>
                  </VStack>
                </Box>

                <Flex justify="center" w="full" pt={4}>
                  <Button variant="ghost" size="lg" onClick={() => skipOnboarding(promptToken ?? undefined)} colorScheme="gray">
                    {promptToken ? 'Skip and generate with public libraries' : 'Skip and explore the app'}
                  </Button>
                </Flex>
              </VStack>
            </Box>
          </MotionBox>
        </Box>
      </Container>
    </Box>
  );
};

export default LibraryProcessing;
