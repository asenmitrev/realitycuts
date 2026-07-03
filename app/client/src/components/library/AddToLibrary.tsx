import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Button,
  VStack,
  Input,
  Text,
  Progress,
  useToast,
  Heading,
  Container,
  HStack,
  FormControl,
  FormLabel,
  Flex,
  IconButton,
  FormErrorMessage,
  Spinner,
  Box,
  Grid,
  Alert,
  AlertIcon,
  Image,
  Switch,
  Tooltip
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApiService } from '../../hooks/useApiService';
import { useDirectS3Upload } from '../../hooks/useDirectS3Upload';
import { profileRemainingLibraryMinutes } from '../../utils';
import { useProfile } from '../../contexts/profile/hooks';
import { FaTrash } from 'react-icons/fa';
import { Controller, FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { useUserId } from '../../contexts/firebase/hooks';
import { useQuery } from 'react-query';
import { ILibrary, ILibraryUpload } from '../../types';
import { MyDropzone } from '../upload/MyDropzone';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { WalkthroughButton } from '../upload/walkthrough/WalkthroughButton';
import { WalkthroughProvider } from '../upload/walkthrough/WalkthroughProvider';
import { OnboardingStepGuide } from './OnboardingStepGuide';
import { useRefetchStats } from '../../contexts/userStats/hooks';
import { useSkipOnboarding } from '../../hooks/useSkipOnboarding';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
const FileItem = ({
  file,
  deleteUpload,
  index,
  isDeletingIds
}: {
  file: { url: string; uploadId: string; name: string; duration: number; isNew: boolean; prompt: string };
  deleteUpload: (uploadId: string, index: number) => void;
  index: number;
  isDeletingIds: string[];
}) => {
  const isDeleting = isDeletingIds.includes(file.uploadId);
  const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);

  return (
    <VStack bg="whiteAlpha.100" overflow="hidden" p={4} alignItems="stretch">
      <HStack display="flex" gap={3} alignItems="flex-start" justifyContent="space-between" borderRadius="md">
        {isImage ? (
          <Box position="relative" width="100px" height="100px" mb={2}>
            <Image src={file.url} alt={file.name} objectFit="cover" width="100%" height="100%" borderRadius="md" />
          </Box>
        ) : null}
        <VStack flexGrow={1} alignItems="flex-start" maxW="100%" overflow="hidden">
          <Box mr={2} color="gray.500" fontSize="sm" flexShrink={1} maxW="100%">
            <Text textOverflow="ellipsis" whiteSpace="nowrap" overflow="hidden">
              {file.name} {file.isNew && '(New)'}
            </Text>
            {!isImage && (
              <Text fontSize="sm" color="gray">
                {Math.ceil(file.duration)}s
              </Text>
            )}
          </Box>
        </VStack>
        <Box display="flex" gap={2} alignItems="center" justifyContent="flex-end">
          <IconButton
            aria-label="Delete uploaded file"
            icon={isDeleting ? <Spinner size="sm" /> : <FaTrash />}
            colorScheme="red"
            size="sm"
            disabled={!file.isNew || isDeleting}
            onClick={() => deleteUpload(file.uploadId, index)}
          />
        </Box>
      </HStack>
    </VStack>
  );
};

type LibraryFormData = {
  title: string;
  isPublic: boolean;
  prompt: string;
  uploadedFiles: { url: string; uploadId: string; name: string; duration: number; isNew: boolean; prompt: string }[];
};

const AddToLibraryContent: React.FC = () => {
  const userProfile = useProfile();
  const methods = useForm<LibraryFormData>({
    defaultValues: {
      isPublic: false
    }
  });
  const { id } = useParams();
  const location = useLocation();
  const userId = useUserId();
  const { register, control } = methods;
  const apiService = useApiService();
  const { uploadFile } = useDirectS3Upload();

  // Check if onboarding parameter is present
  const searchParams = new URLSearchParams(location.search);
  const isOnboarding = searchParams.get('onboarding') === 'true';
  const promptToken = searchParams.get('prompt_token');
  const {
    fields: uploadedFilesFields,
    append: appendUploadedFile,
    remove: removeUploadedFile
  } = useFieldArray({
    control,
    name: 'uploadedFiles'
  });

  const [shouldAutoStart] = useState(false);

  // Check if user has seen the walkthrough before and set autostart accordingly

  const { data, isLoading: isLoadingLibraryItem } = useQuery(
    [id ? 'libraryItem ' + id : 'newLibraryItem', userId],
    async () => {
      return await apiService.get<{
        library: ILibrary;
        processedFiles: {
          link: ILibraryUpload & { _id: string };
          prompt: string;
          status: 'NEW' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
        }[];
      }>(id ? `/api/library/${id}` : '/api/library/new');
    },
    {
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: true
    }
  );
  const { library: libraryItem, processedFiles } = useMemo(() => data ?? { library: null, processedFiles: [] }, [data]);

  useEffect(() => {
    if (!methods.formState.dirtyFields.title) {
      const t = libraryItem?.title;
      methods.setValue('title', t === '' ? 'Untitled Library' : t || '', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false
      });
    }
    if (!methods.formState.dirtyFields.isPublic) {
      methods.setValue('isPublic', libraryItem?.isPublic ?? false, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false
      });
    }
    if (!methods.formState.dirtyFields.uploadedFiles) {
      methods.setValue(
        'uploadedFiles',
        processedFiles.map(upload => ({
          url: upload.link.url,
          uploadId: upload.link._id,
          duration: upload.link.duration,
          name: upload.link.originalName,
          isNew: upload.status === 'NEW',
          prompt: upload.prompt ?? ''
        }))
      );
    }
  }, [processedFiles, methods, libraryItem?.title, libraryItem?.isPublic]);

  const [uploadingVideos, setUploadingVideos] = useState<{ name: string; size: number }[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const refetchStats = useRefetchStats();
  const skipOnboarding = useSkipOnboarding();
  const skipDialogBody = promptToken
    ? 'If you skip adding your own footage, the system will use public libraries made by others. Results may be suboptimal if there is no relevant footage for your prompt. Are you sure you want to continue?'
    : 'If you skip adding your own footage, results may be suboptimal if there is no relevant footage for your prompt. Are you sure you want to continue?';
  const { renderDialog, awaitConfirmation } = useConfirmDialog({
    title: 'Skip Library Setup?',
    type: 'confirm',
    body: skipDialogBody,
    confirmText: 'Skip Anyway',
    cancelText: 'Cancel'
  });
  const uploadFileToS3 = useCallback(
    async (file: File) => {
      if (!libraryItem?._id) {
        toast({
          title: 'Library item not found',
          description: 'This seems to be an issue on our side. Please refresh the page and try again.',
          status: 'error',
          duration: 3000,
          isClosable: true
        });
        return;
      }

      // Add file to uploading videos before starting the upload
      setUploadingVideos(prev => [...prev, { name: file.name, size: file.size, prompt: '' }]);

      try {
        const response = await uploadFile(file, libraryItem._id, progress => {
          setUploadProgress(prev => ({ ...prev, [file.name]: progress.percentage }));
        });

        appendUploadedFile({
          url: response.url,
          uploadId: response.uploadId,
          name: response.name,
          duration: response.duration,
          isNew: true,
          prompt: ''
        });
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        toast({
          title: 'Upload failed',
          description: `Failed to upload ${file.name}. Please try again.`,
          status: 'error',
          duration: 3000,
          isClosable: true
        });
      } finally {
        // Remove file from uploading videos to free up a slot
        setUploadingVideos(prev => prev.filter(f => f.name !== file.name));
        // Clean up progress state
        setUploadProgress(prev => {
          const newState = { ...prev };
          delete newState[file.name];
          return newState;
        });
      }
    },
    [libraryItem?._id, toast, uploadFile, appendUploadedFile]
  );

  // Use this effect to process the next batch of uploads whenever conditions change
  useEffect(() => {
    const processNextBatch = async () => {
      // If we're already processing a batch or there are no pending uploads, do nothing
      if (isProcessingBatch || pendingUploads.length === 0) {
        return;
      }

      const maxConcurrentUploads = 3;
      // Calculate how many more files we can upload based on current uploading videos
      const availableSlots = Math.max(0, maxConcurrentUploads - uploadingVideos.length);

      if (availableSlots === 0) {
        return;
      }

      // Mark that we're processing a batch to prevent multiple batches from being processed at once
      setIsProcessingBatch(true);

      try {
        // Take only as many files as we have available slots
        const nextBatch = pendingUploads.slice(0, availableSlots);
        // Remove files we're about to process from the pending queue
        setPendingUploads(pendingUploads.slice(availableSlots));

        nextBatch.map(async file => {
          await uploadFileToS3(file);
        });
        // Process uploads in parallel rather than sequentially
        await new Promise(resolve => setTimeout(resolve, 100));
      } finally {
        setIsProcessingBatch(false);
      }
    };

    processNextBatch();
  }, [pendingUploads, uploadingVideos.length, isProcessingBatch, uploadFileToS3]);

  const handleFileUpload = (files: File[]) => {
    if (files.length === 0) return;

    // Check file sizes (1GB = 1024 * 1024 * 1024 bytes)
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 1GB in bytes
    const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB for images
    const oversizedFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      return file.size > (isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE);
    });

    if (oversizedFiles.length > 0) {
      toast({
        title: 'File size too large',
        description: `The following files exceed the size limit: ${oversizedFiles.map(f => f.name).join(', ')}`,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
      return;
    }

    // Filter out duplicates
    const uniqueFiles = Array.from(files).filter(
      file => !uploadingVideos.some(v => v.name === file.name) && !pendingUploads.some(p => p.name === file.name)
    );

    if (uniqueFiles.length === 0) {
      toast({
        title: 'Duplicate files',
        description: 'All selected files are already being uploaded.',
        status: 'warning',
        duration: 3000,
        isClosable: true
      });
      return;
    }

    // Calculate how many files we can upload immediately vs queue for later
    const maxConcurrentUploads = 3;
    const availableSlots = Math.max(0, maxConcurrentUploads - uploadingVideos.length);
    const canUploadNow = Math.min(availableSlots, uniqueFiles.length);

    // Files to upload immediately
    const immediateFiles = uniqueFiles.slice(0, canUploadNow);
    // Files to queue for later
    const queuedFiles = uniqueFiles.slice(canUploadNow);

    // Add files to the pending queue
    if (queuedFiles.length > 0) {
      setPendingUploads(prev => [...prev, ...queuedFiles]);

      toast({
        title: 'Files queued for upload',
        description: `${queuedFiles.length} files have been queued and will upload automatically.`,
        status: 'info',
        duration: 3000,
        isClosable: true
      });
    }

    // Start uploading immediate files in parallel
    Promise.all(immediateFiles.map(file => uploadFileToS3(file)));
  };

  const [deletingUploadIds, setDeletingUploadIds] = useState<string[]>([]);

  const deleteUpload = async (uploadId: string, index: number) => {
    try {
      setDeletingUploadIds(prev => [...prev, uploadId]);
      removeUploadedFile(index);
      await apiService.delete(`/api/library/${libraryItem?._id}/upload/${uploadId}`);
    } finally {
      setDeletingUploadIds(prev => prev.filter(id => id !== uploadId));
    }
  };

  const totalDuration = useMemo(() => {
    const totalUploadedDuration = uploadedFilesFields
      .filter(file => file.isNew)
      .reduce((acc, file) => acc + file.duration, 0);
    return Math.ceil(totalUploadedDuration / 60);
  }, [uploadedFilesFields]);

  const isDurationExceeded = useMemo(() => {
    const remainingLibraryMinutes = profileRemainingLibraryMinutes(userProfile);

    return totalDuration > remainingLibraryMinutes;
  }, [totalDuration, userProfile]);

  const noNewVideos = uploadedFilesFields.filter(f => f.isNew).length === 0;

  const handleSubmit = async (data: LibraryFormData) => {
    if (isDurationExceeded || !libraryItem?._id) {
      return;
    }
    const filesWithPrompt: LibraryFormData['uploadedFiles'] = data.uploadedFiles.map(f => ({
      ...f,
      prompt: f.isNew ? data.prompt : f.prompt
    }));
    if (noNewVideos) {
      if (methods.formState.isDirty) {
        await apiService.put(`/api/library/${libraryItem?._id}`, data);
        toast({
          title: 'Library updated',
          description: 'Your library has been updated.',
          status: 'success',
          duration: 3000,
          isClosable: true
        });
      } else {
        toast({
          title: 'No videos to process',
          description: 'Please upload at least one video file.',
          status: 'error',
          duration: 3000,
          isClosable: true
        });
      }
      return;
    }

    await apiService.post(`/api/library/${libraryItem?._id}/process`, {
      uploadedFiles: filesWithPrompt,
      isPublic: data.isPublic,
      title: data.title ?? 'Untitled Library'
    });

    // If onboarding, redirect to processing page, otherwise go to libraries
    if (isOnboarding) {
      await refetchStats();
      const processingUrl = promptToken ? `/library/processing?prompt_token=${promptToken}` : '/library/processing';
      navigate(processingUrl);
    } else {
      navigate('/libraries');
    }
  };

  const shimmerAnimation = keyframes`
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  `;
  if (isLoadingLibraryItem) {
    return <GlobalSpinner />;
  }
  return (
    <WalkthroughProvider>
      <Container w="100%" maxW={{ base: '100%', md: '1000px' }} pb={10}>
        {isOnboarding && (
          <Box position="relative" overflow="hidden">
            {/* Welcome Header */}
            <VStack spacing={4} mt={10} mb={2} position="relative">
              <Heading
                as="h1"
                fontSize={{ base: '2xl', md: '3xl' }}
                fontWeight="800"
                textAlign="center"
                bgGradient="linear(to-r, #22D0FF, #ec8933, #f6a355)"
                bgClip="text"
                bgSize="200% auto"
                animation={`${shimmerAnimation} 4s linear infinite`}
                letterSpacing="-0.02em"
              >
                Let’s create your first media library
              </Heading>
              <Text
                fontSize={{ base: 'md', md: 'lg' }}
                textAlign="center"
                color="gray.400"
                maxW="500px"
                lineHeight="1.6"
              >
                RealityCuts uses real footage to create amazing content. Add footage to your library to get personalized
                results, or skip to use public libraries made by other users.
              </Text>
            </VStack>

            <OnboardingStepGuide currentStep={1} />
          </Box>
        )}
        {!isOnboarding && (
          <Flex justify="space-between" align="center" mb="12" mt="10">
            <Heading>Add Your Library</Heading>
            <WalkthroughButton walkthroughType="addToLibrary" isSample={shouldAutoStart} />
          </Flex>
        )}

        <Box
          borderRadius="xl"
          bg={
            isOnboarding
              ? 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)'
              : 'whiteAlpha.100'
          }
          p={{ base: 6, md: 8 }}
          overflow="hidden"
          width="full"
          boxShadow={isOnboarding ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)' : 'xl'}
          borderColor={isOnboarding ? 'whiteAlpha.100' : 'whiteAlpha.200'}
          borderWidth={1}
          backdropFilter="blur(10px)"
          position="relative"
        >
          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(handleSubmit)}>
              <VStack spacing={4} alignItems="stretch">
                <VStack alignItems="stretch">
                  <HStack
                    gap={{ base: 0, md: 8 }}
                    justifyContent="space-between"
                    alignItems={{ base: 'flex-start', md: 'center' }}
                    flexDirection={{ base: 'column', md: 'row' }}
                  >
                    <FormControl
                      mb={{ base: 0, md: 4 }}
                      isInvalid={!!methods.formState.errors.isPublic}
                      w={{ base: '100%', md: '35%' }}
                    >
                      <FormLabel>Library Name</FormLabel>
                      <Input placeholder={`Enter library name`} {...register('title')} />
                      <FormErrorMessage>{methods.formState.errors.title?.message}</FormErrorMessage>
                    </FormControl>
                    <FormControl
                      mb={8}
                      mt={9}
                      isInvalid={!!methods.formState.errors.isPublic}
                      alignItems="flex-end"
                      flexDirection="column"
                      w="auto"
                      display="flex"
                    >
                      <Controller
                        name="isPublic"
                        control={control}
                        render={({ field: { value, onChange, ...rest } }) => (
                          <Switch
                            isChecked={value}
                            size="lg"
                            onChange={onChange}
                            {...rest}
                            display="flex"
                            gap={2}
                            alignItems="center"
                          >
                            <Tooltip
                              label={
                                'Making your library public will allow other users to view and use your content. Only content you own or have permission to share should be made public.'
                              }
                              hasArrow
                              placement="left"
                            >
                              Public
                            </Tooltip>
                          </Switch>
                        )}
                      />
                      <FormErrorMessage>{methods.formState.errors.isPublic?.message}</FormErrorMessage>
                    </FormControl>
                  </HStack>
                </VStack>

                {/* File Upload Section */}
                <MyDropzone onDrop={handleFileUpload} height={100} type="mixed-video-image" />

                {(
                  <>
                    {uploadingVideos.length > 0 ? (
                      <>
                        <Alert status="info">
                          <AlertIcon />
                          Uploading videos, please do not close the page...
                        </Alert>
                        <Grid gap={3} mb={4} templateColumns="repeat(2, 1fr)">
                          {uploadingVideos.map((file, index) => (
                            <VStack key={index} bg="whiteAlpha.100" p={4} borderRadius="md" alignItems="stretch">
                              <HStack justifyContent="space-between">
                                <Text textOverflow="ellipsis" fontSize="sm" whiteSpace="nowrap" overflow="hidden">
                                  {file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB
                                </Text>
                                <Spinner size="sm" />
                              </HStack>
                              {uploadProgress[file.name] > 99 ? null : (
                                <Progress value={uploadProgress[file.name] || 0} size="sm" colorScheme="blue" />
                              )}
                            </VStack>
                          ))}
                        </Grid>
                      </>
                    ) : null}

                    {pendingUploads.length > 0 ? (
                      <>
                        <Alert status="info" mt={uploadingVideos.length > 0 ? 0 : 4} mb={4}>
                          <AlertIcon />
                          {pendingUploads.length} files queued for upload and will process automatically
                        </Alert>
                        <Grid gap={3} mb={8} templateColumns="repeat(2, 1fr)">
                          {pendingUploads.map((file, index) => (
                            <VStack key={index} bg="whiteAlpha.50" p={4} borderRadius="md" alignItems="stretch">
                              <HStack justifyContent="space-between">
                                <Text textOverflow="ellipsis" fontSize="sm" whiteSpace="nowrap" overflow="hidden">
                                  {file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB
                                </Text>
                                <Text fontSize="xs" color="gray.400">
                                  Pending
                                </Text>
                              </HStack>
                            </VStack>
                          ))}
                        </Grid>
                      </>
                    ) : null}

                    {uploadedFilesFields.length > 0 ? (
                      <>
                        <Heading size="md" mb={4}>
                          Uploaded Files ({uploadedFilesFields.length})
                        </Heading>
                        <Grid gap={4} mb={8} templateColumns="repeat(2, 1fr)">
                          {uploadedFilesFields
                            .filter(file => file.isNew)
                            .map((file, index) => (
                              <FileItem
                                key={file.uploadId}
                                file={file}
                                deleteUpload={deleteUpload}
                                index={index}
                                isDeletingIds={deletingUploadIds}
                              />
                            ))}
                        </Grid>
                      </>
                    ) : null}
                  </>
                )}

                <Text
                  color={isDurationExceeded ? 'red.300' : 'gray'}
                  fontSize="sm"
                  textAlign="right"
                  className="library-minutes"
                >
                  {isDurationExceeded
                    ? 'You do not have enough library minutes remaining to process these videos.'
                    : null}{' '}
                  {totalDuration} / {Math.ceil(profileRemainingLibraryMinutes(userProfile))} min
                </Text>

                <HStack justifyContent="flex-end">
                  {/* <Flex alignItems="start" color="gray.500" w="60%">
                    <Text fontSize="sm">
                      Please ensure you have the necessary rights or permissions to use this content. Misuse of
                      copyrighted material may lead to issues with publishing or distribution.
                    </Text>
                  </Flex> */}
                  <HStack>
                    {isOnboarding && (
                      <>
                        <Button
                          variant="ghost"
                          colorScheme="gray"
                          onClick={async () => {
                            try {
                              if (promptToken) await awaitConfirmation();
                              skipOnboarding(promptToken ?? undefined);
                            } catch {
                              // User cancelled, do nothing
                            }
                          }}
                        >
                          {promptToken ? 'Skip and use default libraries instead' : 'Skip for now'}
                        </Button>
                        {renderDialog()}
                      </>
                    )}
                    {noNewVideos && methods.formState.isDirty ? (
                      <Button
                        type="submit"
                        colorScheme="white"
                        isDisabled={
                          libraryItem?.status === 'PROCESSING' ||
                          libraryItem?.status === 'QUEUED' ||
                          !methods.formState.isValid ||
                          uploadingVideos.length > 0
                        }
                        isLoading={methods.formState.isSubmitting}
                      >
                        Save
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        colorScheme="white"
                        isDisabled={
                          libraryItem?.status === 'PROCESSING' ||
                          libraryItem?.status === 'QUEUED' ||
                          !methods.formState.isValid ||
                          uploadingVideos.length > 0 ||
                          noNewVideos
                        }
                        isLoading={methods.formState.isSubmitting}
                      >
                        {id ? 'Update Library' : 'Create Library'}
                      </Button>
                    )}
                  </HStack>
                </HStack>
              </VStack>
            </form>
          </FormProvider>
        </Box>
      </Container>
    </WalkthroughProvider>
  );
};

export const AddToLibrary: React.FC = () => {
  return (
    <WalkthroughProvider>
      <AddToLibraryContent />
    </WalkthroughProvider>
  );
};
