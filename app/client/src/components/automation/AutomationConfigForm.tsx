import { FC, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Box,
  Container,
  Flex,
  Heading,
  HStack,
  VStack,
  Accordion,
  useColorModeValue,
  Tooltip,
  useToast
} from '@chakra-ui/react';
import { FormProvider, useForm } from 'react-hook-form';
import { AutomationConfigFormData, IAutomationConfig } from '../../types';
import { BasicInformation } from './BasicInformation';
import { ScheduleConfiguration } from './ScheduleConfiguration';
import { ContentSettings } from './ContentSettings';
import { PlatformSelection } from './PlatformSelection';
import { LibrarySelection } from './LibrarySelection';
import { CaptionPresetSelection } from './CaptionPresetSelection';
import { CombinedPreview } from './CombinedPreview';
import { AutomationScriptsPanel } from './AutomationScriptsPanel';
import { useUploadForm } from '../upload/hooks';
import {
  useCreateAutomationConfig,
  useUpdateAutomationConfig,
  useTestGeneration
} from '../../hooks/useAutomationConfig';
import { useAutomationLimits } from '../../hooks/useAutomationLimits';
import { useApiService } from '../../hooks/useApiService';
import { useUserId } from '../../contexts/firebase/hooks';
import { useQuery } from 'react-query';
import {
  convertDailyTimesToLocal,
  convertDailyTimesToUTC,
  convertUTCTimeToLocal,
  convertLocalTimeToUTC
} from '../../utils/timezone';
import { useProfile } from '../../contexts/profile/hooks';
import { FaEye, FaPlay } from 'react-icons/fa6';

// Generate randomized default daily times
const generateRandomDailyTimes = () => {
  // First time: random between 9-11 AM (9:00 to 11:00)
  const firstHour = 9 + Math.floor(Math.random() * 3); // 9, 10, or 11
  // Minutes must be in increments of 5 (0, 5, 10, 15, ..., 55)
  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const firstMinute = minuteOptions[Math.floor(Math.random() * minuteOptions.length)];

  // Second time: 3 hours after the first
  // Since we're adding whole hours, minutes stay the same (already a multiple of 5)
  const secondHour = (firstHour + 3) % 24;
  const secondMinute = firstMinute;

  // Third time: 4 hours after the second
  // Since we're adding whole hours, minutes stay the same (already a multiple of 5)
  const thirdHour = (secondHour + 4) % 24;
  const thirdMinute = secondMinute;

  return [
    { hour: firstHour, minute: firstMinute, label: 'morning' },
    { hour: secondHour, minute: secondMinute, label: 'afternoon' },
    { hour: thirdHour, minute: thirdMinute, label: 'evening' }
  ];
};

const defaultValues: AutomationConfigFormData = {
  isEnabled: true,
  pexels: false,
  isAllPublicLibrariesSelected: false,
  schedule: {
    type: 'DAILY',
    dailyTimes: generateRandomDailyTimes()
  },
  contentSettings: {
    theme: '',
    voiceId: 'cjVigY5qzO86Huf0OWal',
    isVoicePremium: true,
    privateLibraryIds: [],
    publicLibraryIds: [],
    pexels: false,
    isPublic: true,
    brandWatermarkUploadId: undefined,
    brandWatermarkPosition: undefined,
    hashtags: '',
    includeMusic: true,
    musicPrompt: '',
    orientation: 'vertical',
    generateThumbnail: true,
    captionPreset: undefined,
    sources: []
  },
  platforms: {
    youtube: {
      enabled: false,
      channelId: undefined,
      channelName: undefined
    }
  },
  libraries: [],
  selectedTags: []
};

interface AutomationConfigFormProps {
  existingConfig?: IAutomationConfig;
  isEdit?: boolean;
}

export const AutomationConfigForm: FC<AutomationConfigFormProps> = ({ existingConfig, isEdit = false }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [testGenerationResult, setTestGenerationResult] = useState<string | null>(null);

  const textColor = useColorModeValue('white', 'white');

  const [isShowAdvancedSettings, setIsShowAdvancedSettings] = useState(false);

  const [isLoadingTestGeneration, setIsLoadingTestGeneration] = useState(false);
  // Get voice data from upload hooks
  const { voices } = useUploadForm({ uploadType: 'script' });
  const toast = useToast();
  // Get automation limits
  const { data: automationLimits, isLoading: isLoadingLimits } = useAutomationLimits();

  // Get API service and user data
  const apiService = useApiService();
  const userId: string = useUserId();

  // Get brand assets
  const profile = useProfile();
  const hasBrandEntitlement = (profile?.entitlements ?? []).some((e: { name: string }) => e.name === 'brand-watermark');

  // Check if existing config has a watermark (load assets even if entitlement check is pending)
  const hasExistingWatermark = !!existingConfig?.contentSettings?.brandWatermarkUploadId;

  const { data: brandAssets = [] } = useQuery({
    queryKey: ['brandAssets', userId],
    queryFn: async (): Promise<{ _id: string; name?: string; s3UploadId: { url: string } }[]> => {
      const response = await apiService.get<{ assets: { _id: string; name?: string; s3UploadId: { url: string } }[] }>(
        `/api/brand-assets`
      );
      return response.assets ?? [];
    },
    enabled: (hasBrandEntitlement || hasExistingWatermark) && !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false
  });

  // Convert UTC times to local times when loading existing configuration
  const getFormDefaultValues = (): AutomationConfigFormData => {
    if (!existingConfig) {
      return {
        ...defaultValues,
        schedule: {
          ...defaultValues.schedule,
          dailyTimes: generateRandomDailyTimes()
        }
      };
    }

    const localSchedule = { ...existingConfig.schedule };

    // Convert daily times from UTC to local
    if (localSchedule.dailyTimes) {
      localSchedule.dailyTimes = convertDailyTimesToLocal(localSchedule.dailyTimes);
    }

    // Convert weekly time from UTC to local
    if (localSchedule.weeklyTime) {
      localSchedule.weeklyTime = convertUTCTimeToLocal(localSchedule.weeklyTime);
    }

    return {
      isEnabled: existingConfig.isEnabled,
      schedule: localSchedule,
      contentSettings: {
        ...existingConfig.contentSettings,
        isPublic: existingConfig.contentSettings.isPublic ?? true,
        captionPreset: existingConfig.contentSettings.captionPreset || undefined,
        brandWatermarkUploadId: existingConfig.contentSettings.brandWatermarkUploadId || undefined,
        brandWatermarkPosition: existingConfig.contentSettings.brandWatermarkPosition || undefined,
        hashtags: existingConfig.contentSettings.hashtags || '',
        orientation: existingConfig.contentSettings.orientation || 'vertical',
        generateThumbnail: existingConfig.contentSettings.generateThumbnail || false,
        sources: existingConfig.contentSettings?.sources ?? []
      },
      platforms: {
        youtube: {
          enabled: existingConfig.platforms?.youtube?.enabled ?? false,
          channelId: existingConfig.platforms?.youtube?.channelId,
          channelName: existingConfig.platforms?.youtube?.channelName
        }
      },
      pexels: existingConfig.contentSettings.pexels || false,
      isAllPublicLibrariesSelected: existingConfig.contentSettings.allPublicLibrariesSelected || false,
      libraries: [],
      selectedTags: []
    };
  };

  const methods = useForm<AutomationConfigFormData>({
    mode: 'onChange',
    defaultValues: getFormDefaultValues()
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
    watch,
    getValues
  } = methods;

  const createMutation = useCreateAutomationConfig();
  const updateMutation = useUpdateAutomationConfig();
  const testGenerationMutation = useTestGeneration();

  const onSubmit = async ({
    libraries,
    selectedTags,
    pexels,
    isAllPublicLibrariesSelected,
    ...data
  }: AutomationConfigFormData) => {
    try {
      if (
        selectedTags.length === 0 &&
        !isAllPublicLibrariesSelected &&
        libraries.filter(l => l.isSelected).length === 0 &&
        !pexels
      ) {
        return toast({
          title: 'No Content Selected',
          description: 'Please select at least one library or public library',
          status: 'error'
        });
      }

      // Convert local times to UTC before sending to backend
      const utcSchedule = { ...data.schedule };

      // Convert daily times from local to UTC
      if (utcSchedule.dailyTimes) {
        utcSchedule.dailyTimes = convertDailyTimesToUTC(utcSchedule.dailyTimes);
      }

      // Convert weekly time from local to UTC
      if (utcSchedule.weeklyTime) {
        utcSchedule.weeklyTime = convertLocalTimeToUTC(utcSchedule.weeklyTime);
      }

      const submitData = {
        ...data,
        schedule: utcSchedule,
        contentSettings: {
          ...data.contentSettings,
          theme: data.contentSettings.theme || '',
          allPublicLibrariesSelected: isAllPublicLibrariesSelected,
          voiceId: data.contentSettings.voiceId,
          isVoicePremium: voices.find(v => v.id === data.contentSettings.voiceId)?.premium,
          privateLibraryIds: libraries.filter(l => l.isSelected).map(l => l._id),
          publicLibraryIds: selectedTags.map(t => t.libraryId).filter((t): t is string => t !== null),
          pexels,
          isPublic: data.contentSettings.isPublic ?? true,
          includeMusic: data.contentSettings.includeMusic || false,
          musicPrompt: data.contentSettings.musicPrompt || '',
          captionPreset: data.contentSettings.captionPreset,
          brandWatermarkUploadId: data.contentSettings.brandWatermarkUploadId,
          brandWatermarkPosition: data.contentSettings.brandWatermarkPosition,
          hashtags: data.contentSettings.hashtags || '',
          orientation: data.contentSettings.orientation || 'vertical',
          generateThumbnail: data.contentSettings.generateThumbnail || false,
          sources: data.contentSettings.sources ?? []
        },
        platforms: {
          youtube: {
            enabled: data.platforms?.youtube?.enabled ?? false,
            channelId: data.platforms?.youtube?.enabled ? data.platforms?.youtube?.channelId : undefined,
            channelName: data.platforms?.youtube?.enabled ? data.platforms?.youtube?.channelName : undefined
          }
        }
      };

      if (isEdit && id) {
        await updateMutation.mutateAsync({
          id,
          data: submitData
        });
        navigate('/automation-configs');
      } else {
        await createMutation.mutateAsync(submitData);
        navigate('/automation-configs');
      }
    } catch (error) {
      // Error handling is managed by the mutation hooks
    }
  };

  const onTestGeneration = async () => {
    try {
      setIsLoadingTestGeneration(true);
      await handleTestGeneration();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingTestGeneration(false);
    }
  };
  const handleTestGeneration = async () => {
    const currentValues = getValues();
    const libraries = getValues('libraries') || [];
    const selectedTags = getValues('selectedTags') || [];
    const pexels = getValues('pexels') || false;
    const isAllPublicLibrariesSelected = getValues('isAllPublicLibrariesSelected') || false;

    // Validate that theme is present
    if (!currentValues.contentSettings?.theme) {
      toast({
        title: 'Missing Theme',
        description: 'Please enter a content theme before testing',
        status: 'error'
      });
      return;
    }

    if (libraries.length === 0 && selectedTags.length === 0 && !pexels) {
      toast({
        title: 'No Content Selected',
        description: 'Please select at least one library or public library',
        status: 'error'
      });
      return;
    }
    const testParams = {
      theme: currentValues.contentSettings.theme,
      channelId: 'test',
      voiceType: currentValues.contentSettings.voiceId,
      hashtags: currentValues.contentSettings.hashtags,
      isTalkingHead: false,
      includeMusic: currentValues.contentSettings.includeMusic || false,
      brollDuration: 3.5,
      useVideoEmbeddings: true,
      privateLibraryIds: libraries.filter(l => l.isSelected).map(l => l._id),
      publicLibraryIds: selectedTags.map(t => t.libraryId).filter((t): t is string => t !== null),
      isVoicePremium: voices.find(v => v.id === currentValues.contentSettings.voiceId)?.premium || false,
      size: '1080p' as const,
      language: 'en',
      isAllPublicLibrariesSelected,
      captions: currentValues.contentSettings.captionPreset,
      libraries: {
        pexels
      },
      orientation: currentValues.contentSettings.orientation === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL'
    };

    await testGenerationMutation.mutateAsync(testParams, {
      onSuccess: (data: unknown) => {
        // Store the transcription job ID for the button state
        if (data && typeof data === 'object' && 'transcriptionJobId' in data) {
          setTestGenerationResult((data as { transcriptionJobId: string }).transcriptionJobId);
        }
      }
    });
  };

  return (
    <Container maxW="1600px" mb={8} px={{ base: 4, md: 8 }}>
      <FormProvider {...methods}>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <VStack w="100%" align="stretch" spacing={6}>
            {/* Header */}
            <Flex justify="space-between" align="center" w="100%" mb={2} mt={8}>
              <Heading size="lg" color={textColor}>
                {isEdit ? 'Edit Automation' : 'Create Automation'}
              </Heading>
            </Flex>

            {/* Main Content: Two Column Layout (Preview + Form) */}
            <Flex
              flexDirection={{ base: 'column-reverse', lg: 'row' }}
              gap={8}
              align={{ base: 'stretch', lg: 'flex-start' }}
            >
              {/* Left Column: Combined Preview (on mobile, this appears at bottom due to column-reverse) */}
              <Box w={{ base: '100%', lg: '400px' }} flexShrink={0}>
                <CombinedPreview brandAssets={brandAssets} />
              </Box>

              {/* Right Column: Form Content */}
              <VStack flex={1} align="stretch" spacing={6}>
                <Accordion allowToggle defaultIndex={0} w="100%">
                  <ContentSettings
                    voices={voices}
                    testGenerationResult={testGenerationResult}
                    handleTestGeneration={handleTestGeneration}
                  />

                  <PlatformSelection />

                  {isEdit && id ? <AutomationScriptsPanel configId={id} /> : null}

                  <LibrarySelection existingConfig={existingConfig} />

                  <CaptionPresetSelection />

                  {isShowAdvancedSettings && (
                    <>
                      <BasicInformation hasBrandEntitlement={hasBrandEntitlement} brandAssets={brandAssets} />

                      <ScheduleConfiguration
                        automationLimits={automationLimits}
                        isLoadingLimits={isLoadingLimits}
                        isEdit={isEdit}
                      />
                    </>
                  )}
                </Accordion>

                {!isShowAdvancedSettings && (
                  <Flex align="center" w="100%" my={4}>
                    <Box flex="1" height="1px" bg="whiteAlpha.200" />
                    <Button
                      variant="ghost"
                      size="xs"
                      mx={4}
                      onClick={() => setIsShowAdvancedSettings(!isShowAdvancedSettings)}
                    >
                      Show advanced settings
                    </Button>
                    <Box flex="1" height="1px" bg="whiteAlpha.200" />
                  </Flex>
                )}
              </VStack>
            </Flex>

            {/* Action Buttons */}
            <HStack spacing={4} justify="flex-end" w="100%">
              {/* Test Generation Button */}
              {testGenerationResult ? (
                <Tooltip label="Test video has been generated successfully! Click to view progress.">
                  <Button
                    as={Link}
                    to={`/upload-progress/${testGenerationResult}`}
                    target="_blank"
                    isLoading={isLoadingTestGeneration}
                    colorScheme="green"
                    variant="outline"
                    size="md"
                    leftIcon={<FaEye />}
                  >
                    View Test Video
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip
                  label={`Generate a test video with current settings to preview the content before setting up automation${watch('contentSettings.includeMusic') ? ' (including background music)' : ''
                    }`}
                >
                  <Button
                    onClick={onTestGeneration}
                    isLoading={isLoadingTestGeneration}
                    colorScheme="white"
                    variant="outline"
                    size="md"
                    leftIcon={<FaPlay />}
                    isDisabled={!watch('contentSettings.theme')}
                  >
                    Generate Test Video
                  </Button>
                </Tooltip>
              )}
              <Tooltip
                label={
                  !watch('contentSettings.theme')
                    ? 'Please enter a content theme before creating an automation'
                    : ''
                }
              >
                <Button
                  colorScheme="white"
                  isLoading={isSubmitting}
                  type="submit"
                  isDisabled={
                    !isEdit && !watch('contentSettings.theme')
                  }
                >
                  {isEdit ? 'Update Configuration' : 'Create Configuration'}
                </Button>
              </Tooltip>
            </HStack>
          </VStack>
        </form>
      </FormProvider>
    </Container>
  );
};
