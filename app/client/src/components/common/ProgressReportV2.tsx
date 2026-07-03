import { FC, useEffect, useMemo, useState } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { Box, Text, Container, VStack, Heading, Progress, useColorModeValue, Button, Icon } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { keyframes } from '@emotion/react';
import { FaPhotoVideo } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

export const ProgressReportV2: FC<{
  isDeleting?: boolean;
  title?: string;
  eventId: string;
  onDelete?: () => void;
  showDisclaimer?: boolean;
}> = ({ isDeleting, title, eventId, onDelete, showDisclaimer }) => {
  const messages = useMessages(eventId);
  const navigate = useNavigate();
  const lastMessage = messages?.[messages.length - 1];
  const progress = Math.round(lastMessage?.progress ?? 0);
  const [fadeOut, setFadeOut] = useState(false);
  const [lastMessageState, setLastMessageState] = useState(lastMessage);
  const [color, setColor] = useState('hsl(0, 100%, 50%)');
  const getRandomColor = () => {
    const random = Math.random();
    if (random < 0.25) {
      return 'green.200';
    } else if (random < 0.5) {
      return 'yellow.200';
    } else if (random < 0.75) {
      return 'teal.200';
    } else {
      return 'blue.200';
    }
  };
  useEffect(() => {
    setFadeOut(true);
    const timeout = setTimeout(() => {
      setFadeOut(false);
      setLastMessageState(lastMessage);
      setColor(getRandomColor());
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage?.message]);

  const cardBgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');

  const hasError = useMemo(() => {
    return messages?.find(m => m.isError === true);
  }, [messages]);

  const shimmerAnimation = keyframes`
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  `;

  const pulseAnimation = keyframes`
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
  `;

  return (
    <>
      <Box display="flex" alignItems="center" justifyContent="center" p={4}>
        <Container maxW="md" pt={6}>
          {showDisclaimer && !hasError && (
            <Box
              mb={6}
              p={6}
              borderRadius="xl"
              bg="linear-gradient(135deg, rgba(236, 137, 51, 0.15) 0%, rgba(34, 208, 255, 0.08) 50%, rgba(246, 163, 85, 0.12) 100%)"
              border="1px solid"
              borderColor="whiteAlpha.200"
              position="relative"
              overflow="hidden"
            >
              {/* Subtle animated glow */}
              <Box
                position="absolute"
                top="-50%"
                right="-20%"
                w="200px"
                h="200px"
                borderRadius="full"
                bg="radial-gradient(circle, rgba(34, 208, 255, 0.15) 0%, transparent 70%)"
                animation={`${pulseAnimation} 4s ease-in-out infinite`}
              />
              <Box
                position="absolute"
                bottom="-30%"
                left="-10%"
                w="150px"
                h="150px"
                borderRadius="full"
                bg="radial-gradient(circle, rgba(236, 137, 51, 0.12) 0%, transparent 70%)"
                animation={`${pulseAnimation} 5s ease-in-out infinite`}
              />

              <VStack spacing={4} position="relative" zIndex={1}>
                {/* Icon */}
                <Box
                  w={12}
                  h={12}
                  borderRadius="full"
                  bg="linear-gradient(135deg, #22D0FF 0%, #ec8933 100%)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  boxShadow="0 4px 20px rgba(34, 208, 255, 0.3)"
                >
                  <Icon as={FaPhotoVideo} boxSize={5} color="white" />
                </Box>

                {/* Title with gradient */}
                <Heading
                  as="h3"
                  fontSize="lg"
                  fontWeight="700"
                  textAlign="center"
                  bgGradient="linear(to-r, #22D0FF, #ec8933, #f6a355)"
                  bgClip="text"
                  bgSize="200% auto"
                  animation={`${shimmerAnimation} 4s linear infinite`}
                  letterSpacing="-0.01em"
                >
                  Want to create videos on any topic?
                </Heading>

                {/* Description */}
                <Text fontSize="sm" color="gray.300" textAlign="center" lineHeight="1.6" maxW="320px">
                  Your video is using public video libraries, which are limited. Create your own library with personal
                  footage for results perfectly tailored to your content.
                </Text>

                {/* CTA Button */}
                <Button
                  size="md"
                  bg="linear-gradient(135deg, #22D0FF 0%, #ec8933 100%)"
                  color="white"
                  fontWeight="600"
                  px={6}
                  _hover={{
                    bg: 'linear-gradient(135deg, #1bc4f0 0%, #d97a2a 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 20px rgba(34, 208, 255, 0.4)'
                  }}
                  _active={{ transform: 'translateY(0)' }}
                  transition="all 0.2s"
                  leftIcon={<Icon as={HiSparkles} />}
                  onClick={() => navigate('/library/add?onboarding=true')}
                >
                  Create Your Library
                </Button>
              </VStack>
            </Box>
          )}
          <Box mt={12} bg={cardBgColor} borderRadius="lg" p={8} border="1px solid" borderColor="whiteAlpha.200">
            <VStack spacing={8}>
              <VStack spacing={6}>
                <Heading as="h1" size="xl" color="white">
                  {hasError ? 'Error Occurred' : title || 'Processing...'}
                </Heading>
                <Box w="100%" h={2}>
                  <Progress value={progress} size="sm" colorScheme={hasError ? 'red' : 'white'} borderRadius="full" />
                </Box>
              </VStack>

              <Box display="flex" alignItems="center" justifyContent="center">
                <Text color={color} textAlign="center" transition={'opacity 0.2s'} opacity={fadeOut ? 0 : 1}>
                  {lastMessageState?.message}
                </Text>
              </Box>

              {!hasError && (
                <Text fontSize="sm" color="white">
                  {progress}% Complete
                </Text>
              )}

              {onDelete && import.meta.env.VITE_LOCAL_DEVELOPMENT === 'true' && (
                <Button
                  isLoading={isDeleting}
                  isDisabled={isDeleting}
                  px={4}
                  py={2}
                  borderRadius="md"
                  bg="red.500"
                  color="white"
                  _hover={{ bg: 'red.600' }}
                  onClick={onDelete}
                >
                  Delete
                </Button>
              )}

              {!hasError && (
                <Text fontSize="xs" color={'white'} mt={2}>
                  You can leave this page, we will send you a notification when everything is ready.
                </Text>
              )}
            </VStack>
          </Box>
        </Container>
      </Box>
    </>
  );
};
