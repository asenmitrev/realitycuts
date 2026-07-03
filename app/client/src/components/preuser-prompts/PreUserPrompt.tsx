// src/components/PreUserPrompt.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserId, useIsFirebaseInitializing } from '../../contexts/firebase/hooks';
import { useApiService } from '../../hooks/useApiService';
import { ApiError } from '../../service/apiService';
import { useQuery } from '../../hooks/useQuery';
import { Box, Text, Container, VStack, Heading, Icon, Flex, Button, HStack, Divider } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { HiSparkles } from 'react-icons/hi2';
import { HiMail } from 'react-icons/hi';
import { FiVideo, FiCheck, FiEdit2, FiSearch, FiFilm, FiLayers, FiPlayCircle, FiClock } from 'react-icons/fi';

const submittingMessages = [
  { message: 'Fetching your prompt...', progress: 20 },
  { message: 'Searching for footage...', progress: 40 },
  { message: 'Setting up your video...', progress: 60 },
  { message: 'Kicking off generation...', progress: 80 },
  { message: 'Your video is on its way!', progress: 100 }
];

// Keyframe animations
const shimmerAnimation = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const pulseAnimation = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.1); }
`;

const floatAnimation = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
`;

const rotateAnimation = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const progressPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
`;

const fadeInAnimation = keyframes`
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
`;

type Status = 'submitting' | 'queued' | 'error';

export default function PreUserPrompt() {
  const userId = useUserId();
  const isLoading = useIsFirebaseInitializing();
  const doubleGenerationFlag = useRef(false);
  const navigate = useNavigate();
  const apiService = useApiService();
  const query = useQuery();
  const promptToken = query.get('prompt_token');

  const [status, setStatus] = useState<Status>('submitting');
  const [, setLibraryId] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  // Animation state for progress/messages
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  const triggerGeneration = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!promptToken) {
      navigate('/', { replace: true });
      return;
    }
    if (isLoading) return;

    if (!userId) {
      navigate(`/login?prompt_token=${promptToken}`, { replace: true });
      return;
    }

    if (doubleGenerationFlag.current) {
      return;
    }
    doubleGenerationFlag.current = true;

    const run = () => {
      setAnimating(true);
      apiService
        .get<{ prompt: string; libraryIds?: string }>(`/api/preuser-prompts/${promptToken}`)
        .then(async data => {
          const body: { prompt: string; libraryIds?: string } = { prompt: data.prompt };
          if (data.libraryIds) body.libraryIds = data.libraryIds;
          const result = await apiService.post<{ jobId: string; libraryId: string }, typeof body>(
            '/api/videos/one-shot',
            body
          );
          setLibraryId(result.libraryId);
          setStatus('queued');
        })
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.statusCode === 409) {
            navigate('/', { replace: true });
            return;
          }
          setStatus('error');
          setAnimating(false);
        });
    };

    triggerGeneration.current = run;
    run();
  }, [userId, isLoading, promptToken, navigate, apiService]);

  // Animate progress/messages only while the API call is in flight
  useEffect(() => {
    if (!animating || status !== 'submitting') return;
    const messageInterval = setInterval(() => {
      setFadeOut(true);
      setTimeout(() => {
        setCurrentMessageIndex(i => (i + 1) % submittingMessages.length);
        setFadeOut(false);
      }, 200);
    }, 1200);
    return () => clearInterval(messageInterval);
  }, [animating, status]);

  const currentMessage = submittingMessages[currentMessageIndex];

  const processSteps = [
    {
      number: '01',
      icon: FiEdit2,
      title: 'Type Your Prompt',
      description: 'Describe the video you want — topic, tone, length. No scripting required.',
      color: '#22D0FF',
    },
    {
      number: '02',
      icon: FiSearch,
      title: 'AI Researcher Gets to Work',
      description: 'Our AI scours the web to build an accurate, fact-checked script tailored to your prompt.',
      color: '#4dd4ac',
    },
    {
      number: '03',
      icon: FiFilm,
      title: 'Real B-Roll Sourced',
      description: 'We search the internet for relevant footage that matches your script — no stock subscriptions needed.',
      color: '#a78bfa',
    },
    {
      number: '04',
      icon: FiLayers,
      title: 'Script Meets Footage',
      description: 'Your narration is combined with the best b-roll found. Where nothing fits, AI-generated imagery fills the gap.',
      color: '#f472b6',
    },
    {
      number: '05',
      icon: FiPlayCircle,
      title: 'Preview in Hours',
      description: 'Your video is assembled and ready for preview. Approve, edit, or request changes.',
      color: '#ec8933',
    },
  ];

  if (status === 'queued') {
    return (
      <Box
        minH="100vh"
        display="flex"
        alignItems="flex-start"
        justifyContent="center"
        py={{ base: 10, md: 16 }}
        px={4}
        position="relative"
        overflow="hidden"
      >
        {/* Background glow effects */}
        <Box
          position="absolute"
          top="10%"
          left="5%"
          w="500px"
          h="500px"
          borderRadius="full"
          bg="radial-gradient(circle, rgba(34, 208, 255, 0.07) 0%, transparent 70%)"
          animation={`${pulseAnimation} 7s ease-in-out infinite`}
          pointerEvents="none"
        />
        <Box
          position="absolute"
          bottom="5%"
          right="5%"
          w="400px"
          h="400px"
          borderRadius="full"
          bg="radial-gradient(circle, rgba(236, 137, 51, 0.06) 0%, transparent 70%)"
          animation={`${pulseAnimation} 9s ease-in-out infinite`}
          pointerEvents="none"
        />

        <Container maxW="lg">
          <VStack spacing={8} animation={`${fadeInAnimation} 0.5s ease-out`}>

            {/* Header */}
            <VStack spacing={3} textAlign="center">
              <Flex align="center" gap={2} mb={1}>
                <Box
                  w={8}
                  h={8}
                  borderRadius="full"
                  bg="linear-gradient(135deg, #22D0FF 0%, #ec8933 100%)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  boxShadow="0 4px 16px rgba(34, 208, 255, 0.35)"
                >
                  <Icon as={FiCheck} boxSize={4} color="white" />
                </Box>
                <Text fontSize="sm" fontWeight="600" color="#22D0FF" letterSpacing="0.08em" textTransform="uppercase">
                  Video Queued
                </Text>
              </Flex>
              <Heading
                as="h1"
                fontSize={{ base: '2xl', md: '3xl' }}
                fontWeight="800"
                color="white"
                letterSpacing="-0.03em"
                lineHeight="1.1"
              >
                Your video is being crafted
              </Heading>
              <Text fontSize="md" color="gray.400" maxW="420px" lineHeight="1.7">
                Great things take time. We run a full pipeline — research, footage sourcing, and editing —
                to deliver a video that actually looks good.
              </Text>
            </VStack>

            {/* Email notification callout */}
            <Box
              w="100%"
              bg="linear-gradient(135deg, rgba(34, 208, 255, 0.08) 0%, rgba(236, 137, 51, 0.08) 100%)"
              border="1px solid"
              borderColor="rgba(34, 208, 255, 0.25)"
              borderRadius="xl"
              p={5}
              position="relative"
              overflow="hidden"
            >
              <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                h="1px"
                bgGradient="linear(to-r, transparent, #22D0FF, #ec8933, transparent)"
                opacity={0.5}
              />
              <HStack spacing={4} align="flex-start">
                <Box
                  flexShrink={0}
                  w={10}
                  h={10}
                  borderRadius="lg"
                  bg="rgba(34, 208, 255, 0.15)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={HiMail} boxSize={5} color="#22D0FF" />
                </Box>
                <VStack spacing={0.5} align="flex-start">
                  <Text fontSize="sm" fontWeight="700" color="white">
                    We'll email you when it's ready
                  </Text>
                  <Text fontSize="sm" color="gray.400" lineHeight="1.6">
                    Generation takes up to 2 hours. You'll get a link to view, edit, and approve your video
                    the moment it's done. Feel free to close this tab.
                  </Text>
                </VStack>
              </HStack>
            </Box>

            {/* Why it takes time callout */}
            <Box
              w="100%"
              bg="whiteAlpha.50"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="xl"
              p={5}
            >
              <HStack spacing={3} mb={2}>
                <Icon as={FiClock} boxSize={4} color="gray.400" />
                <Text fontSize="xs" fontWeight="700" color="gray.400" letterSpacing="0.08em" textTransform="uppercase">
                  Why does it take so long?
                </Text>
              </HStack>
              <Text fontSize="sm" color="gray.400" lineHeight="1.7">
                Unlike simple AI text, video requires live web research, footage discovery across thousands of
                sources, AI narration rendering, and multi-track editing — all chained in sequence. Each step
                takes real time to ensure quality you can actually use.
              </Text>
            </Box>

            {/* Process steps */}
            <Box w="100%">
              <Text fontSize="xs" fontWeight="700" color="gray.500" letterSpacing="0.1em" textTransform="uppercase" mb={4}>
                What's happening behind the scenes
              </Text>
              <VStack spacing={0} align="stretch">
                {processSteps.map((step, idx) => (
                  <Box key={step.number} position="relative">
                    <HStack spacing={4} align="flex-start" py={4}>
                      {/* Step number + connector line */}
                      <VStack spacing={0} align="center" flexShrink={0} w="40px">
                        <Box
                          w={10}
                          h={10}
                          borderRadius="lg"
                          bg={`${step.color}18`}
                          border="1px solid"
                          borderColor={`${step.color}40`}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          position="relative"
                          zIndex={1}
                        >
                          <Icon as={step.icon} boxSize={4} color={step.color} />
                        </Box>
                        {idx < processSteps.length - 1 && (
                          <Box
                            w="1px"
                            flex={1}
                            minH="24px"
                            bg="whiteAlpha.100"
                            mt={1}
                          />
                        )}
                      </VStack>

                      {/* Content */}
                      <VStack spacing={1} align="flex-start" flex={1} pb={idx < processSteps.length - 1 ? 2 : 0}>
                        <HStack spacing={2}>
                          <Text fontSize="xs" color="gray.600" fontWeight="600" fontFamily="mono">
                            {step.number}
                          </Text>
                          <Text fontSize="sm" fontWeight="700" color="white">
                            {step.title}
                          </Text>
                        </HStack>
                        <Text fontSize="sm" color="gray.400" lineHeight="1.6">
                          {step.description}
                        </Text>
                      </VStack>
                    </HStack>
                    {idx < processSteps.length - 1 && (
                      <Divider borderColor="whiteAlpha.50" />
                    )}
                  </Box>
                ))}
              </VStack>
            </Box>

            {/* Dashboard link */}
            <Button
              variant="ghost"
              color="gray.500"
              fontSize="sm"
              _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
              onClick={() => navigate('/')}
            >
              Go to dashboard
            </Button>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" p={4}>
        <Container maxW="md">
          <VStack spacing={6} animation={`${fadeInAnimation} 0.5s ease-out`}>
            <Box
              bg="whiteAlpha.100"
              borderRadius="xl"
              p={8}
              border="1px solid"
              borderColor="whiteAlpha.200"
              w="100%"
              textAlign="center"
            >
              <VStack spacing={4}>
                <Heading as="h1" fontSize="2xl" fontWeight="700" color="white">
                  Something went wrong
                </Heading>
                <Text color="gray.400">
                  We couldn't queue your video. Please try again or contact support.
                </Text>
                <Button
                  mt={2}
                  bg="white"
                  color="black"
                  _hover={{ bg: 'gray.200' }}
                  onClick={() => {
                    doubleGenerationFlag.current = false;
                    setStatus('submitting');
                    setCurrentMessageIndex(0);
                    triggerGeneration.current?.();
                  }}
                >
                  Try again
                </Button>
                <Button
                  variant="ghost"
                  color="gray.500"
                  fontSize="sm"
                  _hover={{ color: 'white' }}
                  onClick={() => navigate('/')}
                >
                  Go to dashboard
                </Button>
              </VStack>
            </Box>
          </VStack>
        </Container>
      </Box>
    );
  }

  // status === 'submitting'
  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      position="relative"
      overflow="hidden"
    >
      {/* Background glow effects */}
      <Box
        position="absolute"
        top="20%"
        left="10%"
        w="400px"
        h="400px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(34, 208, 255, 0.08) 0%, transparent 70%)"
        animation={`${pulseAnimation} 6s ease-in-out infinite`}
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="10%"
        right="15%"
        w="350px"
        h="350px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(236, 137, 51, 0.06) 0%, transparent 70%)"
        animation={`${pulseAnimation} 8s ease-in-out infinite`}
        pointerEvents="none"
      />

      <Container maxW="md">
        <VStack spacing={8}>
          {/* Animated icon */}
          <Box position="relative" animation={`${floatAnimation} 3s ease-in-out infinite`}>
            {/* Rotating ring */}
            <Box
              position="absolute"
              inset="-12px"
              borderRadius="full"
              border="2px dashed"
              borderColor="whiteAlpha.200"
              animation={`${rotateAnimation} 20s linear infinite`}
            />
            {/* Glowing background */}
            <Box
              position="absolute"
              inset="-20px"
              borderRadius="full"
              bg="radial-gradient(circle, rgba(34, 208, 255, 0.2) 0%, transparent 70%)"
              animation={`${pulseAnimation} 2s ease-in-out infinite`}
            />
            {/* Icon container */}
            <Box
              w={20}
              h={20}
              borderRadius="full"
              bg="linear-gradient(135deg, #22D0FF 0%, #ec8933 100%)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="0 8px 32px rgba(34, 208, 255, 0.3)"
              position="relative"
            >
              <Icon as={FiVideo} boxSize={8} color="white" />
            </Box>
          </Box>

          {/* Main card */}
          <Box
            bg="whiteAlpha.100"
            borderRadius="xl"
            p={8}
            border="1px solid"
            borderColor="whiteAlpha.200"
            w="100%"
            position="relative"
            overflow="hidden"
          >
            {/* Subtle gradient overlay */}
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              h="2px"
              bgGradient="linear(to-r, transparent, #22D0FF, #ec8933, transparent)"
              opacity={0.6}
            />

            <VStack spacing={6}>
              {/* Title with shimmer */}
              <Heading
                as="h1"
                fontSize={{ base: '2xl', md: '3xl' }}
                fontWeight="700"
                textAlign="center"
                bgGradient="linear(to-r, white, #22D0FF, #ec8933, white)"
                bgClip="text"
                bgSize="200% auto"
                animation={`${shimmerAnimation} 4s linear infinite`}
                letterSpacing="-0.02em"
              >
                Processing your request
              </Heading>

              {/* Custom progress bar */}
              <Box w="100%" position="relative">
                <Box h="6px" bg="whiteAlpha.100" borderRadius="full" overflow="hidden">
                  <Box
                    h="100%"
                    w={`${currentMessage.progress}%`}
                    bgGradient="linear(to-r, #22D0FF, #ec8933)"
                    borderRadius="full"
                    transition="width 0.5s ease-out"
                    position="relative"
                    _after={{
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      bgGradient: 'linear(to-r, transparent, whiteAlpha.400, transparent)',
                      animation: `${shimmerAnimation} 2s linear infinite`
                    }}
                  />
                </Box>
                {/* Progress percentage */}
                <Text fontSize="sm" fontWeight="600" color="gray.400" textAlign="right" mt={2}>
                  {currentMessage.progress}%
                </Text>
              </Box>

              {/* Animated message */}
              <Box h="60px" display="flex" alignItems="center" justifyContent="center">
                <Flex align="center" gap={2} opacity={fadeOut ? 0 : 1} transition="opacity 0.2s ease-out">
                  <Icon
                    as={HiSparkles}
                    boxSize={4}
                    color="#22D0FF"
                    animation={`${progressPulse} 1s ease-in-out infinite`}
                  />
                  <Text
                    fontSize="lg"
                    fontWeight="500"
                    bgGradient="linear(to-r, #22D0FF, #ec8933)"
                    bgClip="text"
                    textAlign="center"
                  >
                    {currentMessage.message}
                  </Text>
                </Flex>
              </Box>

              {/* Status indicators */}
              <Flex gap={3} flexWrap="wrap" justify="center">
                {submittingMessages.slice(0, currentMessageIndex + 1).map((_, idx) => (
                  <Box
                    key={idx}
                    px={3}
                    py={1.5}
                    bg={idx === currentMessageIndex ? 'whiteAlpha.150' : 'whiteAlpha.50'}
                    borderRadius="full"
                    border="1px solid"
                    borderColor={idx === currentMessageIndex ? 'whiteAlpha.300' : 'whiteAlpha.100'}
                    transition="all 0.3s ease"
                  >
                    <Flex align="center" gap={1.5}>
                      <Icon as={FiCheck} boxSize={3} color={idx < currentMessageIndex ? 'green.400' : '#22D0FF'} />
                      <Text
                        fontSize="xs"
                        color={idx === currentMessageIndex ? 'white' : 'gray.400'}
                        fontWeight="medium"
                      >
                        Step {idx + 1}
                      </Text>
                    </Flex>
                  </Box>
                ))}
              </Flex>
            </VStack>
          </Box>

          {/* Footer message */}
          <Text fontSize="sm" color="gray.500" textAlign="center" maxW="320px">
            Generating your video...
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}
