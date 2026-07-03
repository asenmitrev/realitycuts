import { FC, useState, useRef, useEffect } from 'react';
import {
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Heading,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText,
  Textarea,
  Text,
  IconButton,
  useDisclosure,
  useColorModeValue,
  RadioGroup,
  Radio,
  Stack,
  PopoverTrigger,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  Popover
} from '@chakra-ui/react';
import { Controller, useFormContext } from 'react-hook-form';
import { FaInfoCircle, FaPause, FaPlay } from 'react-icons/fa';
import { AutomationConfigFormData } from '../../types';
import { VoiceSelectorModal } from '../upload/VoiceSelector';
import { AutomationPdfSourceSection } from './AutomationPdfSourceSection';

interface Voice {
  id: string;
  name: string;
  preview: string;
  premium: boolean;
  tags: string[];
}

interface ContentSettingsProps {
  voices: Voice[];
  testGenerationResult: string | null;
  handleTestGeneration: () => void;
}

export const ContentSettings: FC<ContentSettingsProps> = ({ voices }) => {
  const {
    control,
    register,
    formState: { errors },
    watch
  } = useFormContext<AutomationConfigFormData>();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const bgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const textColor = useColorModeValue('white', 'white');

  useEffect(() => {
    if (currentlyPlayingAudio) {
      audioRef.current?.play();
    } else {
      audioRef.current?.pause();
    }
  }, [currentlyPlayingAudio]);

  const selectedVoiceId = watch('contentSettings.voiceId');
  const selectedVoice = voices.find(v => v.id === selectedVoiceId);

  return (
    <AccordionItem
      borderTop="4px solid"
      borderTopColor="blue.400"
      borderLeft="1px solid"
      borderRight="1px solid"
      borderBottom="1px solid"
      borderLeftColor={borderColor}
      borderRightColor={borderColor}
      borderBottomColor={borderColor}
      borderRadius="lg"
      bg={bgColor}
      mb={4}
    >
      <AccordionButton py={4}>
        <Box flex="1" textAlign="left">
          <Heading as="h2" size="md" color={textColor}>
            Content Settings
          </Heading>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4}>
        <VStack spacing={6} align="stretch">
          <FormControl isInvalid={!!errors.contentSettings?.theme?.message} isRequired>
            <FormLabel color={textColor}>Automation Topic</FormLabel>
            <Textarea
              {...register('contentSettings.theme', {
                required: 'Automation prompt is required'
              })}
              placeholder='Describe the topic for the automation. Include any specific instructions, call-to-actions, or footage requirements.'
              rows={4}
              bg="blue.950"
              borderColor="blue.400"
              borderWidth="2px"
              _hover={{ borderColor: 'blue.300' }}
              _focus={{ borderColor: 'cyan.400', boxShadow: '0 0 0 1px var(--chakra-colors-cyan-400)' }}
            />
            <FormHelperText>
              {"This theme will guide the AI in creating content that matches your channel's style and messaging"}
            </FormHelperText>
            <FormErrorMessage>{errors.contentSettings?.theme?.message?.toString()}</FormErrorMessage>
          </FormControl>

          <AutomationPdfSourceSection textColor={textColor} />

          {/* Voice Selection */}
          {(
            <FormControl>
              <FormLabel color={textColor}>Voice Selection</FormLabel>
              <Controller
                name="contentSettings.voiceId"
                control={control}
                render={({ field }) => (
                  <>
                    <Box
                      p={4}
                      borderRadius="xl"
                      bg="whiteAlpha.100"
                      borderWidth="1px"
                      borderColor="whiteAlpha.200"
                      cursor="pointer"
                      onClick={onOpen}
                      _hover={{
                        borderColor: 'blue.400'
                      }}
                    >
                      <HStack justify="space-between">
                        <Text textTransform="capitalize" color={textColor}>
                          {selectedVoice ? selectedVoice.name : 'Select a voice'}
                        </Text>
                        <IconButton
                          aria-label={selectedVoice ? `Play ${selectedVoice.name} sample` : 'Play sample'}
                          icon={currentlyPlayingAudio === field.value ? <FaPause /> : <FaPlay />}
                          variant="ghost"
                          colorScheme="blue"
                          size="sm"
                          isDisabled={!selectedVoice}
                          onClick={e => {
                            e.stopPropagation();
                            setCurrentlyPlayingAudio(v => (v === field.value ? null : field.value || null));
                          }}
                        />
                      </HStack>
                      {selectedVoice && (
                        <audio src={selectedVoice.preview} style={{ display: 'none' }} ref={audioRef} />
                      )}
                    </Box>

                    <VoiceSelectorModal
                      isOpen={isOpen}
                      onClose={onClose}
                      voices={voices}
                      initialVoiceId={field.value}
                      onSelectVoice={voiceId => {
                        field.onChange(voiceId);
                        onClose();
                      }}
                    />
                  </>
                )}
              />
              <FormHelperText>Choose the voice that will be used for automated video generation</FormHelperText>
            </FormControl>
          )}

          {/* Video Orientation */}
          {(
            <FormControl>
              <FormLabel color={textColor}>
                Video Orientation
                <Popover placement="right">
                  <PopoverTrigger>
                    <IconButton ml={2} aria-label="Info" size="xs" variant="ghost" icon={<FaInfoCircle />} />
                  </PopoverTrigger>
                  <PopoverContent bg="black">
                    <PopoverArrow />
                    <PopoverBody bg="gray.700" borderColor="whiteAlpha.200" borderRadius="md">
                      Choose whether to generate videos in horizontal (16:9) or vertical (9:16) format
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </FormLabel>
              <Controller
                name="contentSettings.orientation"
                control={control}
                defaultValue="vertical"
                render={({ field }) => (
                  <RadioGroup {...field} colorScheme="blue">
                    <Stack direction="row" spacing={8}>
                      <Radio value="vertical" color={textColor}>
                        <Text color={textColor}>Vertical (9:16)</Text>
                      </Radio>
                      <Radio value="horizontal" color={textColor}>
                        <Text color={textColor}>Horizontal (16:9)</Text>
                      </Radio>
                    </Stack>
                  </RadioGroup>
                )}
              />
              <FormHelperText>Select the aspect ratio for your automated videos</FormHelperText>
            </FormControl>
          )}
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};
