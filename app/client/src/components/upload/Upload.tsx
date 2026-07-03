import { FC, useState, useRef, useEffect, memo, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Container,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Textarea,
  RadioGroup,
  Radio,
  Stack,
  Switch,
  HStack,
  Box,
  Text,
  IconButton,
  VStack,
  InputGroup,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useToast
} from '@chakra-ui/react';
import { Controller, FormProvider } from 'react-hook-form';
import { useQuery } from '../../hooks/useQuery';
import { useProfile } from '../../contexts/profile/hooks';
import { UploadFormData, UploadType } from '../../types';
import { MyDropzone } from './MyDropzone';
import { LibraryChoice } from './LibraryChoice';
import { VideoSizeChoice } from './VideoSizeChoice';
import { MediaRecorderComponent } from '../common/MediaRecord';
import { useUploadForm } from './hooks';
import { TimeEstimator } from './TimeEstimator';
import { FormDataSaver } from './FormDataSaver';
import { InitialUploadChoices } from './InitialUploadChoices';
import { useDisclosure } from '@chakra-ui/react';
import { VoiceSelectorModal } from './VoiceSelector';
import { FaPause, FaPlay } from 'react-icons/fa';
import { FiFileText, FiMic } from 'react-icons/fi';
import { WalkthroughButton } from './walkthrough/WalkthroughButton';
import { WalkthroughProvider } from './walkthrough/WalkthroughProvider';
import { FaInfoCircle } from 'react-icons/fa';
import { Popover, PopoverTrigger, PopoverContent, PopoverBody, PopoverArrow } from '@chakra-ui/react';
import { profileRemainingLibraryMinutes } from '../../utils';
import { approximateMinutesFromText } from 'shared/utils/misc';
import { validateMediaDuration, getMediaDuration } from '../../utils/mediaUtils';
import { useUploadScriptsStore, VideoScript } from '../../stores/uploadScriptsStore';

const hide: null | number = null;
const AudioTitle = memo(function AudioTitle() {
  const videoScripts = useUploadScriptsStore(state => state.videoScripts);
  const setVideoScripts = useUploadScriptsStore(state => state.setVideoScripts);
  const updateVideoField = (id: string, field: keyof VideoScript, value: string) => {
    setVideoScripts(videos => videos.map(v => (v.id === id ? { ...v, [field]: value } : v)));
  };
  return (
    <InputGroup>
      <Input
        value={videoScripts[0].title}
        onChange={e => updateVideoField(videoScripts[0].id, 'title', e.target.value)}
        type="text"
      />
    </InputGroup>
  );
});
const VideoScripts = memo(function VideoScript({
  isSample,
  uploadType
}: {
  isSample?: boolean;
  uploadType?: UploadType;
}) {
  const videoScripts = useUploadScriptsStore(state => state.videoScripts);
  const setVideoScripts = useUploadScriptsStore(state => state.setVideoScripts);
  const videoScriptRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  useEffect(() => {
    if (isSample) {
      setVideoScripts([
        {
          id: crypto.randomUUID(),
          title: 'Kyudo the way of the bow',
          script:
            "Kyudo, the ancient art of Japanese archery, is more than just hitting a target—it's a moving meditation, a harmony of mind, body, and spirit. Each draw of the bow is a moment of focus, where precision and grace become one. In Kyudo, the true aim is not the target, but the pursuit of inner stillness and perfection."
        }
      ]);
    }
    return () => setVideoScripts([{ id: crypto.randomUUID(), title: '', script: '' }]);
  }, [setVideoScripts, isSample]);

  // const addNewVideo = () => {
  //   const newId = crypto.randomUUID();
  //   setVideoScripts([...videoScripts, { id: newId, title: '', script: '' }]);

  //   setTimeout(() => {
  //     const newVideoElement = videoScriptRefs.current.get(newId);
  //     if (newVideoElement) {
  //       newVideoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  //       newVideoElement.focus();
  //     }
  //   }, 100);
  // };

  // const removeVideo = (id: string) => {
  //   if (videoScripts.length > 1) {
  //     setVideoScripts(videoScripts.filter(v => v.id !== id));
  //   }
  // };

  const updateVideoField = (id: string, field: keyof VideoScript, value: string) => {
    setVideoScripts(videos => videos.map(v => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const languages = {
    eng: 'English',
    rus: 'Russian',
    spa: 'Spanish',
    fra: 'French',
    deu: 'German',
    ita: 'Italian',
    tur: 'Turkish'
  };

  return (
    <Stack spacing={6} w="100%">
      {videoScripts.map((video, index, arr) => (
        <Box
          key={video.id}
          p={4}
          borderWidth="1px"
          background="whiteAlpha.100"
          borderColor="whiteAlpha.200"
          borderRadius="md"
        >
          <FormControl mb={4}>
            <FormLabel alignItems="center" display="flex" justifyContent="space-between" gap={2}>
              Video {arr.length > 1 ? index + 1 : ''} Title
            </FormLabel>
            <InputGroup>
              <Input
                value={video.title}
                onChange={e => updateVideoField(video.id, 'title', e.target.value)}
                type="text"
              />
            </InputGroup>
          </FormControl>

          <FormControl>
            <FormLabel display="flex" alignItems="center" gap={2}>
              {uploadType === 'prompt' ? 'Prompt' : 'Script'}
              <Popover placement="right">
                <PopoverTrigger>
                  <IconButton aria-label="Info" icon={<FaInfoCircle />} />
                </PopoverTrigger>
                <PopoverContent bg="black">
                  <PopoverArrow />
                  <PopoverBody bg="whiteAlpha.100" borderColor="whiteAlpha.200" borderRadius="md">
                    <Text fontWeight="bold" mb={2}>
                      Available Languages (in Beta):
                    </Text>
                    {Object.entries(languages).map(([code, name]) => (
                      <Text key={code}>{name}</Text>
                    ))}
                  </PopoverBody>
                </PopoverContent>
              </Popover>
            </FormLabel>
            <Textarea
              rows={10}
              value={video.script}
              ref={el => {
                if (el) {
                  videoScriptRefs.current.set(video.id, el);
                } else {
                  videoScriptRefs.current.delete(video.id);
                }
              }}
              onChange={e => updateVideoField(video.id, 'script', e.target.value)}
            />
            <TimeEstimator script={video.script} />
          </FormControl>
        </Box>
      ))}
    </Stack>
  );
});

const UploadMinutesDisplay = memo(function UploadMinutesDisplay({
  uploadType
}: {
  uploadType?: UploadType | 'scriptAudio';
}) {
  const videoScripts = useUploadScriptsStore(state => state.videoScripts);
  const userProfile = useProfile();

  const totalEstimatedMinutes = useMemo(() => {
    if (uploadType !== 'script' && uploadType !== 'prompt') return 0;

    return Math.ceil(
      videoScripts.reduce((total, video) => {
        return total + approximateMinutesFromText(video.script);
      }, 0)
    );
  }, [videoScripts, uploadType]);

  const remainingMinutes = Math.ceil(profileRemainingLibraryMinutes(userProfile));
  const isDurationExceeded = totalEstimatedMinutes > remainingMinutes;

  if ((uploadType !== 'script' && uploadType !== 'prompt') || totalEstimatedMinutes === 0) {
    return null;
  }

  return (
    <Text color={isDurationExceeded ? 'red.300' : 'gray'} fontSize="sm" textAlign="right" mt={4}>
      {isDurationExceeded ? 'You do not have enough minutes remaining to generate these videos.' : null}{' '}
      {totalEstimatedMinutes} / {remainingMinutes} min estimated
    </Text>
  );
});

export const Upload: FC = () => {
  const query = useQuery();
  const audioRef = useRef<HTMLAudioElement>(null);
  const navigate = useNavigate();
  const videoScripts = useUploadScriptsStore(state => state.videoScripts);
  const isAdmin = !!query.get('admin');
  const urlIsSample = !!query.get('sample');
  const userProfile = useProfile();
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<string | null>(null);
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const [shouldAutoStart] = useState(false);
  const toast = useToast();

  // Combine URL-based sample with localStorage-based auto-start
  const isSample = urlIsSample;

  const uploadType =
    (urlSearchParams.get('type') as UploadType | 'scriptAudio') || (userProfile?.isAdmin ? undefined : 'prompt');
  const { methods, onSubmit, voices, setFile, file } = useUploadForm({ uploadType, isSample });
  const {
    handleSubmit,
    register,
    formState: { errors }
  } = methods;
  const chooseType = (type: UploadType | 'scriptAudio') => {
    setUrlSearchParams({ type });
  };
  const { isOpen, onOpen, onClose } = useDisclosure();

  const onFormSubmit = async (data: UploadFormData) => {
    let lastTranscriptionJobId: string | undefined;

    for (let i = 0; i < videoScripts.length; i++) {
      const video = videoScripts[i];
      const videoData = {
        ...data,
        title: video.title,
        script: video.script
      };
      lastTranscriptionJobId = await onSubmit(videoData);

      if (uploadType === 'audio') {
        break;
      }
    }
    if (lastTranscriptionJobId) {
      navigate(`/upload-progress/${lastTranscriptionJobId}`);
    }
  };
  useEffect(() => {
    if (currentlyPlayingAudio) {
      audioRef.current?.play();
    } else {
      audioRef.current?.pause();
    }
  }, [currentlyPlayingAudio]);

  // Validate media duration with proper cleanup of blob URLs
  const validateFileDuration = async (file: File) => {
    const orientation = methods.getValues('orientation');
    let maxDurationMinutes = uploadType === 'audio' ? 3 : 60; // 3 min for audio, 60 min for video
    // For prompt videos, allow 5 minutes for long form, 3 minutes for short form
    if (uploadType === 'prompt' && orientation === 'horizontal') {
      maxDurationMinutes = 5;
    } else if (uploadType === 'prompt' && orientation === 'vertical') {
      maxDurationMinutes = 3;
    }
    return await validateMediaDuration(file, maxDurationMinutes);
  };
  return (
    <Container minW={{ base: '100%', md: '750px' }} mb={8} px={{ base: 4, md: 16 }}>
      {uploadType === undefined ? (
        <InitialUploadChoices chooseType={chooseType} />
      ) : (
        <FormProvider {...methods}>
          <WalkthroughProvider>
            <form
              onSubmit={handleSubmit(onFormSubmit)}
              style={{ display: 'flex', alignItems: 'stretch', gap: 40, flexDirection: 'column' }}
            >
              <Flex flexDirection={{ base: 'column', lg: 'column' }} justify="stretch" align="flex-start">
                <VStack w="100%" align="flex-start" gap={4}>
                  <Flex justify="space-between" align="center" w="100%" mb="6" mt="8">
                    <Heading size="lg">{getHeadingForUploadType(uploadType)}</Heading>
                    {(uploadType === 'script' ||
                      uploadType === 'prompt' ||
                      uploadType === 'audio') && <WalkthroughButton isSample={shouldAutoStart} />}
                  </Flex>
                  {uploadType === 'script' ||
                  uploadType === 'prompt' ||
                  uploadType === 'audio' ? (
                    <Tabs
                      index={uploadType === 'prompt' ? 0 : uploadType === 'script' ? 1 : 2}
                      onChange={index =>
                        chooseType(index === 0 ? 'prompt' : index === 1 ? 'script' : 'audio')
                      }
                      variant="unstyled"
                      w="100%"
                      isLazy
                    >
                      <TabList p={0} gap={2}>
                        <Tab p={0} fontWeight="bold" as="div">
                          <Button
                            aria-label="Prompt"
                            size="sm"
                            leftIcon={<FiFileText />}
                            variant={uploadType === 'prompt' ? 'solid' : 'outline'}
                            colorScheme="white"
                          >Prompt</Button>
                        </Tab>
                        <Tab p={0} fontWeight="bold" as="div">
                          <Button
                            aria-label="Script"
                            size="sm"
                            leftIcon={<FiFileText />}
                            variant={uploadType === 'script' ? 'solid' : 'outline'}
                            colorScheme="white"
                          >Script</Button>
                        </Tab>
                        <Tab p={0} fontWeight="bold" as="div">
                          <Button
                            aria-label="Audio"
                            size="sm"
                            leftIcon={<FiMic />}
                            variant={uploadType === 'audio' ? 'solid' : 'outline'}
                            colorScheme="white"
                          >Audio</Button>
                        </Tab>
                      </TabList>
                      <TabPanels w="100%">
                        <TabPanel px={0} w="100%">
                          <VideoScripts isSample={isSample} uploadType={uploadType} />
                          <FormControl
                            mt={4}
                            isInvalid={!!errors.voiceType?.message}
                            className="voice-selector"
                            as="div"
                          >
                            <FormLabel>Choose voice</FormLabel>
                            <Controller
                              name="voiceType"
                              render={({ field }) => {
                                const selectedVoice = voices.find(v => v.id === field.value);

                                return (
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
                                        <Text textTransform="capitalize">
                                          {selectedVoice ? selectedVoice.name : 'Select a voice'}
                                        </Text>
                                        <IconButton
                                          aria-label={
                                            selectedVoice ? `Play ${selectedVoice.name} sample` : 'Play sample'
                                          }
                                          icon={currentlyPlayingAudio === field.value ? <FaPause /> : <FaPlay />}
                                          variant="ghost"
                                          colorScheme="blue"
                                          size="sm"
                                          isDisabled={!selectedVoice}
                                          onClick={e => {
                                            e.stopPropagation();
                                            setCurrentlyPlayingAudio(v => (v === field.value ? null : field.value));
                                          }}
                                        />
                                      </HStack>
                                      {selectedVoice && (
                                        <audio src={selectedVoice.preview} style={{ display: 'none' }} ref={audioRef} aria-label={`Play ${selectedVoice.name} sample`} />
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
                                );
                              }}
                            />
                            <FormErrorMessage>{errors.voiceType?.message?.toString()}</FormErrorMessage>
                          </FormControl>

                          <UploadMinutesDisplay uploadType={uploadType} />
                          {uploadType === 'prompt' && (
                            <FormControl mt={4}>
                              <FormLabel>Short / Long form</FormLabel>
                              <Controller
                                name="orientation"
                                control={methods.control}
                                defaultValue="vertical"
                                render={({ field }) => (
                                  <RadioGroup {...field} colorScheme="blue">
                                    <Stack direction="row" spacing={8}>
                                      <Radio value="vertical">
                                        <Text>Short form</Text>
                                      </Radio>
                                      <Radio value="horizontal">
                                        <Text>Long form</Text>
                                      </Radio>
                                    </Stack>
                                  </RadioGroup>
                                )}
                              />
                              <FormHelperText>
                                For best results, try to keep your video below 3 minutes long.
                              </FormHelperText>
                            </FormControl>
                          )}
                        </TabPanel>
                        <TabPanel px={0} w="100%">
                          <VideoScripts isSample={isSample} uploadType={uploadType} />
                          <FormControl
                            mt={4}
                            isInvalid={!!errors.voiceType?.message}
                            className="voice-selector"
                            as="div"
                          >
                            <FormLabel>Choose voice</FormLabel>
                            <Controller
                              name="voiceType"
                              render={({ field }) => {
                                const selectedVoice = voices.find(v => v.id === field.value);

                                return (
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
                                        <Text textTransform="capitalize">
                                          {selectedVoice ? selectedVoice.name : 'Select a voice'}
                                        </Text>
                                        <IconButton
                                          aria-label={
                                            selectedVoice ? `Play ${selectedVoice.name} sample` : 'Play sample'
                                          }
                                          icon={currentlyPlayingAudio === field.value ? <FaPause /> : <FaPlay />}
                                          variant="ghost"
                                          colorScheme="blue"
                                          size="sm"
                                          isDisabled={!selectedVoice}
                                          onClick={e => {
                                            e.stopPropagation();
                                            setCurrentlyPlayingAudio(v => (v === field.value ? null : field.value));
                                          }}
                                        />
                                      </HStack>
                                      {selectedVoice && (
                                        <audio src={selectedVoice.preview} style={{ display: 'none' }} ref={audioRef} aria-label={`Play ${selectedVoice.name} sample`} />
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
                                );
                              }}
                            />
                            <FormErrorMessage>{errors.voiceType?.message?.toString()}</FormErrorMessage>
                          </FormControl>

                          <UploadMinutesDisplay uploadType={uploadType} />
                        </TabPanel>
                        <TabPanel px={0}>
                          <FormControl isInvalid={!!errors.title?.message} mb={4}>
                            <FormLabel alignItems="center" display="flex" justifyContent="space-between" gap={2}>
                              Video Title
                            </FormLabel>
                            <AudioTitle />
                          </FormControl>
                          <Flex gap={4} direction={{ base: 'column', md: 'row' }} w="100%">
                            <MediaRecorderComponent
                              onRecordEnd={async blob => {
                                const file = new File([blob], 'recorded-audio.mp3', { type: 'audio/mpeg' });
                                try {
                                  const duration = await getMediaDuration(file);
                                  setFile(file, duration);
                                } catch (error) {
                                  console.warn('Could not extract duration from recorded audio:', error);
                                  setFile(file);
                                }
                              }}
                            />
                            <MyDropzone
                              onDrop={async files => {
                                const file = files[0];
                                const validation = await validateFileDuration(file);

                                if (!validation.isValid) {
                                  toast({
                                    description: validation.message,
                                    status: 'error'
                                  });
                                  return;
                                }

                                // Extract duration and pass it along with the file
                                try {
                                  const duration = await getMediaDuration(file);
                                  setFile(file, duration);
                                } catch (error) {
                                  // If duration extraction fails, still allow upload but without duration
                                  console.warn('Could not extract duration:', error);
                                  setFile(file);
                                }
                              }}
                              fileSelected={file}
                              type={uploadType === 'audio' ? 'audio' : 'video'}
                            />
                          </Flex>
                        </TabPanel>
                      </TabPanels>
                    </Tabs>
                  ) : null}
                  {hide && (
                    <FormControl isInvalid={!!errors.size?.message}>
                      <FormLabel>Video Size</FormLabel>
                      <Controller
                        name="size"
                        render={({ field }) => {
                          return (
                            <RadioGroup onChange={field.onChange} value={field.value}>
                              <Stack direction="row" wrap="wrap" columnGap={8}>
                                <VideoSizeChoice
                                  value="1080p"
                                  label="Horizontal"
                                  isSelected={field.value === '1080p'}
                                />
                                <VideoSizeChoice
                                  value="1080x1920"
                                  label="Vertical"
                                  isSelected={field.value === '1080x1920'}
                                />
                              </Stack>
                            </RadioGroup>
                          );
                        }}
                      />
                      <FormErrorMessage>{errors.size?.message?.toString()}</FormErrorMessage>
                    </FormControl>
                  )}
                  {isAdmin && (
                    <FormControl>
                      <FormLabel>System prompt:</FormLabel>
                      <Textarea
                        rows={10}
                        {...register('systemPrompt', {
                          required: "Shit's required bro."
                        })}
                      />
                      <FormHelperText>
                        YAY, you are admin. Prefilled is the original system prompt. Change it any way you like for epic
                        wins. Be careful, as fucking this up will lead to a failed video generation.
                      </FormHelperText>
                    </FormControl>
                  )}
                  {hide && (
                    <FormControl>
                      <FormLabel>Guidance</FormLabel>
                      <Textarea rows={5} {...register('guidance')} />
                      <FormHelperText>
                        Enter any guidance to the AI and our editors on what you want to get out from this video. What
                        topics should we focus on? What kind of video output are you looking for?
                      </FormHelperText>
                    </FormControl>
                  )}
                  <FormControl>
                    <FormLabel mb={3}>Background Music (BETA)</FormLabel>
                    <Controller
                      name="includeMusic"
                      render={({ field }) => (
                        <Box
                          p={4}
                          borderRadius="xl"
                          bg="whiteAlpha.100"
                          borderWidth="1px"
                          borderColor="whiteAlpha.200"
                          _hover={{
                            borderColor: 'blue.400'
                          }}
                          transition="border-color 0.2s"
                        >
                          <HStack justify="space-between" align="center">
                            <Text fontSize="sm" color="gray.300">
                              Automatically generate and include background music in your videos
                            </Text>
                            <Switch isChecked={field.value} onChange={field.onChange} size="lg" colorScheme="blue" />
                          </HStack>
                        </Box>
                      )}
                    />
                  </FormControl>
                </VStack>
                {uploadType === 'video' ||
                uploadType === 'audio' ||
                uploadType === 'script' ||
                uploadType === 'prompt' ||
                uploadType === 'scriptAudio' ? (
                  <LibraryChoice register={register} uploadType={uploadType} />
                ) : null}
              </Flex>

              <Button
                size="lg"
                isLoading={methods.formState.isSubmitting}
                isDisabled={shouldDisableSubmit(file, uploadType, methods.formState.isSubmitting)}
                type="submit"
              >
                Generate
              </Button>
              <FormDataSaver />
            </form>
          </WalkthroughProvider>
        </FormProvider>
      )}
    </Container>
  );
};

function getHeadingForUploadType(uploadType?: string): string {
  switch (uploadType) {
    case 'video':
      return 'Talking Head Video';
    case 'script':
      return 'AI Video';
    case 'prompt':
      return 'AI Video';
    case 'audio':
      return 'Voiceover Video';
    default:
      return 'Start Your Video Project';
  }
}

function shouldDisableSubmit(file: File | undefined, uploadType?: string, isSubmitting?: boolean): boolean {
  return (
    (!file && uploadType !== 'script' && uploadType !== 'prompt') ||
    uploadType === 'scriptAudio' ||
    !!isSubmitting
  );
}
