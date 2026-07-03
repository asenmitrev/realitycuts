import { useCallback, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  Text,
  Radio,
  IconButton,
  HStack,
  Badge,
  VStack,
  Flex,
  InputGroup,
  InputLeftElement,
  Input,
  Select,
  Button,
  Grid,
  ModalFooter,
  useDisclosure,
  Icon,
  Center,
  Heading
} from '@chakra-ui/react';
import { FaPause, FaPlay, FaSearch, FaCrown, FaCheck, FaStar } from 'react-icons/fa';
import { useIsPlus } from '../../contexts/profile/hooks';
import type { UIVoice } from './AudioChoice';

const VoiceOption: FC<{
  voice: UIVoice;
  isSelected: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onSelect: () => void;
}> = ({ voice, isSelected, isPlaying, onPlay, onSelect }) => {
  const ref = useRef<HTMLAudioElement>(null);
  const isDisabled = false;

  useMemo(() => {
    if (isPlaying) {
      ref.current?.play();
    } else {
      ref.current?.pause();
    }
  }, [isPlaying]);

  return (
    <Box
      p={4}
      borderRadius="xl"
      bg={'whiteAlpha.100'}
      borderWidth="1px"
      borderColor={isSelected ? 'blue.400' : 'transparent'}
      transition="all 0.2s"
      cursor="pointer"
      onClick={onSelect}
      display="flex"
      alignItems="center"
      gap={3}
      w="100%"
      _hover={{
        bg: 'whiteAlpha.100'
      }}
    >
      <Radio colorScheme="blue" value={voice.id} isDisabled={isDisabled} isChecked={isSelected} size="lg" />
      <HStack spacing={2} flexGrow={1} justify="space-between" w="100%">
        <VStack align="flex-start" spacing={1}>
          <Text
            fontSize="md"
            fontWeight="medium"
            color={isSelected ? 'white' : 'whiteAlpha.900'}
            textTransform="capitalize"
          >
            {voice.name}
          </Text>
          <HStack spacing={2}>
            {voice.tags.map(tag => (
              <Badge key={tag} bg="whiteAlpha.200" color="whiteAlpha.800" fontSize="xs">
                {tag?.toUpperCase()}
              </Badge>
            ))}
          </HStack>
        </VStack>
        <IconButton
          aria-label={`Play ${voice.name} voice sample`}
          icon={isPlaying ? <FaPause /> : <FaPlay />}
          variant="ghost"
          colorScheme="blue"
          size="sm"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onPlay();
          }}
          _hover={{
            bg: 'whiteAlpha.200'
          }}
        />
      </HStack>
      {/* biome-ignore lint/a11y/useMediaCaption: voice samples don't ship with captions */}
      <audio src={voice.preview} style={{ display: 'none' }} ref={ref} />
    </Box>
  );
};

const PremiumVoiceUpgradeModal: FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const features = [
    'Higher audio quality and clarity',
    'Unique voice characteristics and styles',
    'Professional-grade voice synthesis',
    'Exclusive voices not available in free plan'
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent
        bg="gray.900"
        color="white"
        borderRadius="xl"
        overflow="hidden"
        border="1px solid"
        borderColor="gray.700"
        mx={4}
      >
        {/* Header with gradient background */}
        <Box bgGradient="linear(to-br, gray.900, gray.800, gray.900)" p={6} pb={8} position="relative">
          <ModalCloseButton color="gray.400" _hover={{ color: 'white', bg: 'gray.800' }} size="sm" top={4} right={4} />

          {/* Crown icon with glow effect */}
          <Center mb={4}>
            <Box position="relative">
              <Box
                position="absolute"
                inset={0}
                bg="yellow.400"
                borderRadius="full"
                filter="blur(12px)"
                opacity={0.3}
              />
              <Box
                position="relative"
                bgGradient="linear(to-br, yellow.400, yellow.500)"
                p={3}
                borderRadius="full"
                w="100%"
              >
                <Icon as={FaCrown} boxSize={8} color="gray.900" />
              </Box>
            </Box>
          </Center>

          {/* Title with badge */}
          <VStack spacing={2} textAlign="center">
            <HStack justify="center" align="center" spacing={2}>
              <Heading size="lg" bgGradient="linear(to-r, white, gray.300)" bgClip="text" fontWeight="bold">
                Premium Voices
              </Heading>
              <Badge
                bg="yellow.500"
                color="yellow.400"
                borderColor="yellow.500"
                borderWidth={1}
                borderRadius="md"
                px={2}
                py={1}
                fontSize="xs"
              >
                <HStack spacing={1}>
                  <Icon as={FaStar} boxSize={3} />
                  <Text>Plus</Text>
                </HStack>
              </Badge>
            </HStack>
            <Text color="gray.400" fontSize="sm" lineHeight="relaxed" maxW="xs" mx="auto">
              Unlock high-quality premium voices with unique styles and characteristics
            </Text>
          </VStack>
        </Box>

        {/* Features section */}
        <ModalBody p={6} pt={0}>
          <Box
            bg="gray.800"
            borderRadius="xl"
            p={5}
            border="1px solid"
            borderColor="gray.700"
            backdropFilter="blur(4px)"
          >
            <HStack mb={4} spacing={2}>
              <Icon as={FaStar} boxSize={5} color="yellow.400" />
              <Heading size="md" fontWeight="semibold">
                Premium voices include:
              </Heading>
            </HStack>

            <VStack spacing={3} align="stretch">
              {features.map(feature => (
                <HStack
                  key={feature}
                  align="flex-start"
                  spacing={3}
                  _hover={{ '& > div:last-child': { color: 'white' } }}
                  transition="all 0.2s"
                  alignItems="center"
                >
                  <Box flexShrink={0} mt={0.5}>
                    <Box
                      bg="green.500"
                      borderRadius="full"
                      w={6}
                      h={6}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Icon as={FaCheck} boxSize={3} strokeWidth={3} />
                    </Box>
                  </Box>
                  <Text color="gray.300" fontSize="sm" lineHeight="relaxed" transition="colors 0.2s">
                    {feature}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export const VoiceSelectorModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectVoice: (voiceId: string) => void;
  voices: UIVoice[];
  initialVoiceId?: string;
}> = ({ isOpen, onClose, onSelectVoice, voices, initialVoiceId }) => {
  const [selectedVoice, setSelectedVoice] = useState<string | null>(initialVoiceId || null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const isPlus = useIsPlus();
  const { isOpen: isUpgradeModalOpen, onClose: onUpgradeModalClose } = useDisclosure();

  const filteredVoices = useMemo(() => {
    return voices.filter(voice => {
      const matchesSearch = voice.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'ALL' ||
        (selectedCategory === 'PREMIUM' && voice.premium) ||
        voice.tags.includes(selectedCategory);
      return voice.premium && matchesSearch && matchesCategory;
    });
  }, [voices, searchQuery, selectedCategory]);

  const categories = useMemo(() => {
    const uniqueTags = [...new Set(voices.flatMap(voice => voice.tags))];
    return [
      { value: 'ALL', label: 'All Voices' },
      { value: 'PREMIUM', label: 'Premium' },
      ...uniqueTags.map(tag => ({ value: tag, label: tag?.replace('_', ' ') }))
    ];
  }, [voices]);
  const handleSelectVoice = useCallback((voiceId: string) => {
    // if (voice?.premium && !isPlus) {
    //   onUpgradeModalOpen();
    //   return;
    // }

    setSelectedVoice(voiceId);
  }, []);

  const handlePlayVoice = useCallback(
    (voiceId: string) => {
      const voice = voices.find(v => v.id === voiceId);

      setPlayingVoice(prevVoice => (prevVoice === voiceId ? null : voiceId));
      // Keep selection in sync with the voice being previewed.
      setSelectedVoice(voiceId);
      if (voice?.premium && !isPlus) {
        return;
      }
    },
    [isPlus, voices]
  );

  const handleConfirm = useCallback(() => {
    if (selectedVoice) {
      onSelectVoice(selectedVoice);
      onClose();
    }
  }, [selectedVoice, onSelectVoice, onClose]);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay backdropFilter="blur(5px)" />
        <ModalContent>
          <ModalHeader fontSize="xl">Choose voice</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6} color="white">
            <VStack spacing={4} align="stretch">
              <Flex gap={3}>
                <InputGroup flex={1}>
                  <InputLeftElement pointerEvents="none">
                    <FaSearch color="gray.300" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search voices..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    _hover={{ bg: 'whiteAlpha.200' }}
                    transition="all 0.2s"
                    _focus={{
                      bg: 'whiteAlpha.200',
                      boxShadow: 'none'
                    }}
                  />
                </InputGroup>

                <Select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  _hover={{ bg: 'whiteAlpha.100' }}
                  _focus={{
                    bg: 'whiteAlpha.100',
                    boxShadow: 'none'
                  }}
                  textTransform="capitalize"
                  w="200px"
                >
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </Select>
              </Flex>

              <Text fontSize="sm" color="gray.200">
                Showing {filteredVoices.length} of {voices.length} voices
              </Text>

              <Grid templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }} gap={2}>
                {filteredVoices.length > 0 ? (
                  filteredVoices.map(voice => (
                    <VoiceOption
                      key={voice.id}
                      voice={voice}
                      isSelected={selectedVoice === voice.id}
                      isPlaying={playingVoice === voice.id}
                      onPlay={() => handlePlayVoice(voice.id)}
                      onSelect={() => handleSelectVoice(voice.id)}
                    />
                  ))
                ) : (
                  <Box textAlign="center" py={8} color="gray.400">
                    No voices found matching your search criteria
                  </Box>
                )}
              </Grid>

              <Flex justify="flex-end" gap={3} mt={4}></Flex>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleConfirm} isDisabled={!selectedVoice}>
              Confirm Selection
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <PremiumVoiceUpgradeModal isOpen={isUpgradeModalOpen} onClose={onUpgradeModalClose} />
    </>
  );
};
