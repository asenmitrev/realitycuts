import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { ILibrary, VideoAlternative } from '../../types';
import { Tag as ITag } from '../../types';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Button,
  Image,
  FormLabel,
  FormErrorMessage,
  FormControl,
  Switch,
  Input,
  Text,
  Box,
  Card,
  Badge,
  IconButton,
  Checkbox,
  Stack,
  Spinner,
  Icon,
  HStack,
  VStack,
  Divider,
  Flex
} from '@chakra-ui/react';
import { Controller, FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { useApiService } from '../../hooks/useApiService';
import { useQuery } from 'react-query';
import { FaPlay, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { useUserId } from '../../contexts/firebase/hooks';
import { debounce } from 'lodash';
import { LibraryModal } from '../upload/PublicLibraryModal';
import { FiFileText, FiFilter, FiMic } from 'react-icons/fi';

const FootagePreview: FC<{ videoAlternative: VideoAlternative; onSelect: () => void }> = ({
  videoAlternative,
  onSelect
}) => {
  const [isShowVideo, setIsShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (videoRef.current && isShowVideo) {
      videoRef.current.play();
    } else {
      videoRef.current?.pause();
    }
  }, [isShowVideo]);

  const handleMouseEnter = () => {
    setIsShowVideo(true);
    setIsLoading(true);
    videoRef.current?.play();
  };

  const handleMouseLeave = () => {
    setIsShowVideo(false);
    setIsLoading(false);
    videoRef.current?.pause();
  };

  return (
    <Box
      display="flex"
      alignItems="stretch"
      justifyContent="stretch"
      position="relative"
      borderRadius={0}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isLoading && (
        <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" zIndex={2}>
          <Spinner color="white" />
        </Box>
      )}
      {!isShowVideo ? (
        <Box w="100%">
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            backgroundColor="rgba(0,0,0,0.3)"
            borderRadius="50%"
            padding={4}
          >
            <FaPlay size={24} />
          </Box>
          <Image
            src={videoAlternative.thumbnailUrl}
            aspectRatio={videoAlternative.isVertical ? '9/16' : '16/9'}
            alt="Video thumbnail."
            objectFit="cover"
            w="100%"
          />
        </Box>
      ) : (
        <Box position="relative">
          <video
            src={videoAlternative.preview}
            autoPlay={true}
            loop={true}
            muted={isMuted}
            style={{
              aspectRatio: videoAlternative.isVertical ? '9/16' : '16/9',
              objectFit: 'cover',
              width: '100%'
            }}
            ref={videoRef}
            onLoadedData={() => setIsLoading(false)}
          ></video>
          <IconButton
            position="absolute"
            top={2}
            left={2}
            size="sm"
            variant="ghost"
            onClick={e => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <FaVolumeUp /> : <FaVolumeMute />}
          </IconButton>
        </Box>
      )}

      <Badge
        position="absolute"
        variant="solid"
        top={3}
        right={3}
        colorScheme="blackAlpha"
        bg="blackAlpha.700"
        backdropFilter="blur(4px)"
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
        maxWidth="80%"
        fontSize="xs"
        fontWeight="semibold"
        px={2}
        py={1}
        borderRadius="md"
      >
        {Math.floor(videoAlternative.duration / 60)}:
        {Math.floor(videoAlternative.duration % 60)
          .toString()
          .padStart(2, '0')}
      </Badge>

      <Button
        variant="solid"
        position="absolute"
        colorScheme="blue"
        bottom={3}
        right={3}
        size="sm"
        onClick={onSelect}
        fontWeight="semibold"
        _hover={{ bg: 'blue.300', transform: 'scale(1.05)' }}
        transition="all 0.2s"
      >
        Select
      </Button>
    </Box>
  );
};

interface SearchFootageData {
  query: string;
  tags: { tag: string; libraryId: string | null }[];
  source: 'pexels' | 'libraries';
  isAllPublicLibrariesSelected: boolean;
}
type SearchFootageFormData = SearchFootageData & {
  libraries: { _id: string; isSelected: boolean; title: string }[];
};
interface SearchFootageModalProps {
  onFootageSelect: (alternatives: VideoAlternative[], keywords: string) => void;
  isOpen: boolean;
  keywords: string;
  privateLibraryIds: string[];
  publicLibraryIds: string[];
  onClose: () => void;
}
export const SearchFootageModal: FC<SearchFootageModalProps> = ({
  onFootageSelect,
  privateLibraryIds,
  publicLibraryIds,
  isOpen,
  keywords: keywordsProp = '',
  onClose
}) => {
  const methods = useForm<SearchFootageFormData>({
    defaultValues: {
      query: '',
      source: 'libraries',
      tags: [],
      isAllPublicLibrariesSelected: true,
      libraries: privateLibraryIds.map(id => ({ _id: id, isSelected: true, title: '' }))
    }
  });

  const {
    fields,
    replace,
    update: updateLibrary
  } = useFieldArray<SearchFootageFormData, 'libraries', '_id'>({
    name: 'libraries',
    control: methods.control
  });

  const {
    handleSubmit,
    watch,
    register,
    formState: { errors }
  } = methods;

  const formValues = watch();
  const [isShowFilters, setIsShowFilters] = useState([...publicLibraryIds, ...privateLibraryIds].length === 0);
  const saveFormValuesDebounced = useRef(
    debounce((values: SearchFootageFormData) => {
      localStorage.setItem('searchFootageFormValues', JSON.stringify(values));
    }, 500)
  ).current;

  useEffect(() => {
    saveFormValuesDebounced(formValues);
    return () => {
      saveFormValuesDebounced.cancel();
    };
  }, [formValues, saveFormValuesDebounced]);

  const { data: libraries } = useQuery({
    queryKey: ['libraries', useUserId()],
    queryFn: async () => {
      return await apiService.get<ILibrary[]>('/api/library');
    }
  });

  const hasInitializedLibraries = useRef(false);
  useEffect(() => {
    if (libraries && !hasInitializedLibraries.current) {
      hasInitializedLibraries.current = true;
      const librariesWithSelection = libraries.map(library => {
        return {
          ...library,
          isSelected: true // Changed from false to true to preselect all
        };
      });
      replace(librariesWithSelection);
    }
  }, [libraries, replace]);

  const [isLoading, setIsLoading] = useState(false);
  const [, setIsLoadingPublicLibraries] = useState(false);
  const apiService = useApiService();
  const [videos, setVideos] = useState<VideoAlternative[]>([]);
  const [keywords, setKeywords] = useState('');
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);

  useEffect(() => {
    const fetchPublicLibraries = async () => {
      if (publicLibraryIds.length > 0) {
        setIsLoadingPublicLibraries(true);
        try {
          const libraries = await apiService.post<{ _id: string; title: string }[], { libraryIds: string[] }>(
            '/api/library/libraries-by-ids',
            {
              libraryIds: publicLibraryIds
            }
          );

          const tagsWithNames = libraries.map(library => ({
            tag: library.title,
            libraryId: library._id
          }));

          methods.setValue('tags', tagsWithNames);
        } catch (error) {
          console.error('Failed to fetch public library names:', error);
        } finally {
          setIsLoadingPublicLibraries(false);
        }
      } else {
        setIsLoadingPublicLibraries(false);
      }
    };

    if (isOpen) {
      fetchPublicLibraries();
    }
  }, [isOpen, publicLibraryIds, apiService, methods]);

  const searchVideos = useCallback(async ({
    query,
    tags,
    source,
    libraries,
    isAllPublicLibrariesSelected
  }: SearchFootageFormData) => {
    try {
      setIsLoading(true);
      setKeywords(query);
      const videos = await apiService.post<
        VideoAlternative[],
        Omit<SearchFootageData, 'tags' | 'source'> & {
          tags: string[];
          privateLibraryIds: string[];
          source: 'libraries' | 'pexels';
        }
      >('/api/search/footage', {
        query,
        tags: tags?.filter(t => t.libraryId === null).map(t => t.tag) ?? [],
        privateLibraryIds: [...(libraries?.filter(l => l.isSelected).map(l => l._id) ?? [])],
        isAllPublicLibrariesSelected,
        source
      });
      setVideos(videos);
    } finally {
      setIsLoading(false);
    }
  }, [apiService]);

  // Pre-fill the query from the keywords prop when the modal opens and auto-trigger search
  useEffect(() => {
    if (!isOpen || !keywordsProp) return;
    methods.setValue('query', keywordsProp);
    searchVideos({ ...methods.getValues(), query: keywordsProp });
  }, [isOpen, keywordsProp, methods, searchVideos]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay bg="blackAlpha.800" backdropFilter="blur(4px)" />
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(searchVideos)}>
          <ModalContent bg="gray.900" borderWidth="1px" borderColor="whiteAlpha.200">
            <ModalHeader fontSize="2xl" fontWeight="bold" pb={4} borderBottomWidth="1px" borderColor="whiteAlpha.100">
              Search Footage
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody py={6}>
              <VStack spacing={6} align="stretch">
                <FormControl isInvalid={!!errors.query?.message}>
                  <FormLabel fontSize="sm" fontWeight="semibold" mb={2} color="gray.300">
                    Search term
                  </FormLabel>
                  <HStack spacing={3}>
                    <Input
                      {...register('query', {
                        required: 'Search term is required.'
                      })}
                      type="text"
                      size="lg"
                      bg="whiteAlpha.50"
                      borderColor="whiteAlpha.200"
                      _hover={{ borderColor: 'whiteAlpha.300' }}
                      _focus={{ borderColor: 'blue.200', boxShadow: '0 0 0 1px var(--chakra-colors-blue-200)' }}
                      placeholder="Enter search keywords..."
                    />
                    <IconButton
                      aria-label="Show filters"
                      icon={<Icon as={FiFilter} />}
                      variant={isShowFilters ? 'solid' : 'outline'}
                      colorScheme={isShowFilters ? 'blue' : 'white'}
                      size="lg"
                      onClick={() => setIsShowFilters(!isShowFilters)}
                    />
                  </HStack>
                  <FormErrorMessage mt={2}>{errors.query?.message?.toString()}</FormErrorMessage>
                </FormControl>
                {isShowFilters && (
                  <Box bg="whiteAlpha.50" borderRadius="lg" p={6} borderWidth="1px" borderColor="whiteAlpha.100">
                    <VStack spacing={6} align="stretch">
                      <FormControl>
                        <FormLabel fontSize="sm" fontWeight="semibold" mb={3} color="gray.300">
                          Choose source
                        </FormLabel>
                        <Controller
                          name="source"
                          render={({ field }) => (
                            <HStack spacing={3}>
                              <Button
                                children="Libraries"
                                aria-label="Libraries"
                                size="md"
                                leftIcon={<FiFileText />}
                                variant={field.value === 'libraries' ? 'solid' : 'outline'}
                                colorScheme={field.value === 'libraries' ? 'blue' : 'white'}
                                minW="140px"
                                onClick={() => field.onChange('libraries')}
                                _hover={{
                                  bg: field.value === 'libraries' ? 'blue.300' : 'whiteAlpha.100'
                                }}
                              />

                              <Button
                                children="Pexels"
                                aria-label="Pexels"
                                size="md"
                                leftIcon={<FiMic />}
                                variant={field.value === 'pexels' ? 'solid' : 'outline'}
                                colorScheme={field.value === 'pexels' ? 'blue' : 'white'}
                                minW="140px"
                                onClick={() => field.onChange('pexels')}
                                _hover={{
                                  bg: field.value === 'pexels' ? 'blue.300' : 'whiteAlpha.100'
                                }}
                              />
                            </HStack>
                          )}
                        />
                      </FormControl>
                      {watch('source') === 'libraries' && (
                        <>
                          <Divider borderColor="whiteAlpha.200" />
                          <FormControl>
                            <FormLabel fontSize="sm" fontWeight="semibold" mb={3} color="gray.300">
                              Public libraries
                            </FormLabel>
                            <Controller
                              name="tags"
                              render={({ field }) => (
                                <VStack spacing={3} align="stretch">
                                  <Button
                                    onClick={() => setIsLibraryModalOpen(true)}
                                    w="full"
                                    size="md"
                                    variant="outline"
                                    colorScheme="white"
                                    borderColor="whiteAlpha.200"
                                    _hover={{ bg: 'whiteAlpha.100', borderColor: 'whiteAlpha.300' }}
                                  >
                                    Select Public Libraries ({field.value?.length || 0} selected)
                                  </Button>
                                  {field.value && field.value.length > 0 && (
                                    <Box
                                      display="flex"
                                      flexWrap="wrap"
                                      gap={2}
                                      p={3}
                                      bg="whiteAlpha.50"
                                      borderRadius="md"
                                      borderWidth="1px"
                                      borderColor="whiteAlpha.100"
                                    >
                                      {field.value.map((tag: { tag: string; libraryId: string | null }, idx: number) =>
                                        tag.tag ? (
                                          <Badge
                                            key={idx}
                                            colorScheme="blue"
                                            borderRadius="full"
                                            px={3}
                                            py={1.5}
                                            display="flex"
                                            alignItems="center"
                                            fontSize="xs"
                                            fontWeight="medium"
                                            bg="blue.500"
                                            color="white"
                                          >
                                            {tag.tag}
                                            <Box
                                              as="span"
                                              ml={2}
                                              cursor="pointer"
                                              fontSize="sm"
                                              fontWeight="bold"
                                              _hover={{ opacity: 0.7 }}
                                              onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                const newTags = [...field.value];
                                                newTags.splice(idx, 1);
                                                field.onChange((v: { tag: string; libraryId: string | null }[]) =>
                                                  v.filter(
                                                    (t: { tag: string; libraryId: string | null }) => t.tag !== tag.tag
                                                  )
                                                );
                                              }}
                                            >
                                              ×
                                            </Box>
                                          </Badge>
                                        ) : null
                                      )}
                                    </Box>
                                  )}
                                  {isOpen && isLibraryModalOpen && (
                                    <LibraryModal
                                      isOpen={isLibraryModalOpen}
                                      onClose={() => setIsLibraryModalOpen(false)}
                                      selectedTags={
                                        field.value?.map(
                                          (tag: {
                                            tag: string;
                                            libraryId: string | null;
                                            videoCount: number;
                                            screenshots: string[];
                                          }) => tag as unknown as ITag
                                        ) || []
                                      }
                                      onTagsChange={(tags: ITag[]) => {
                                        field.onChange(
                                          tags.map((tag: ITag) => ({
                                            tag: tag.tag,
                                            libraryId: tag.libraryId,
                                            videoCount: tag.videoCount,
                                            screenshots: tag.screenshots
                                          }))
                                        );
                                        setIsLibraryModalOpen(false);
                                      }}
                                    />
                                  )}
                                </VStack>
                              )}
                            />
                          </FormControl>
                          <Divider borderColor="whiteAlpha.200" />
                          <FormControl>
                            <Flex justify="space-between" align="center">
                              <FormLabel fontSize="sm" fontWeight="semibold" mb={0} color="gray.300">
                                Select all public libraries
                              </FormLabel>
                              <Controller
                                name="isAllPublicLibrariesSelected"
                                render={({ field }) => (
                                  <Switch
                                    isChecked={field.value}
                                    onChange={field.onChange}
                                    colorScheme="blue"
                                    size="md"
                                  />
                                )}
                              />
                            </Flex>
                          </FormControl>
                          <Divider borderColor="whiteAlpha.200" />
                          <FormControl>
                            <FormLabel fontSize="sm" fontWeight="semibold" mb={3} color="gray.300">
                              Private libraries
                            </FormLabel>
                            <Box
                              maxH="200px"
                              overflowY="auto"
                              p={3}
                              bg="whiteAlpha.50"
                              borderRadius="md"
                              borderWidth="1px"
                              borderColor="whiteAlpha.100"
                            >
                              <Stack
                                direction={['column', 'row']}
                                spacing={4}
                                flexWrap="wrap"
                                sx={{
                                  '&::-webkit-scrollbar': {
                                    width: '8px'
                                  },
                                  '&::-webkit-scrollbar-track': {
                                    bg: 'transparent'
                                  },
                                  '&::-webkit-scrollbar-thumb': {
                                    bg: 'whiteAlpha.200',
                                    borderRadius: '4px',
                                    _hover: {
                                      bg: 'whiteAlpha.300'
                                    }
                                  }
                                }}
                              >
                                {fields?.map((library, index) => {
                                  const fieldName = `libraries.${index}`;
                                  return (
                                    <Controller
                                      key={library._id}
                                      name={fieldName}
                                      render={() => {
                                        return (
                                          <Checkbox
                                            colorScheme="blue"
                                            id={fieldName}
                                            isChecked={library.isSelected}
                                            onChange={function (e) {
                                              console.log('fieldName', fieldName);
                                              updateLibrary(index, { ...library, isSelected: e.target.checked });
                                            }}
                                            _hover={{ color: 'blue.200' }}
                                          >
                                            {library.title}
                                          </Checkbox>
                                        );
                                      }}
                                    />
                                  );
                                })}
                              </Stack>
                            </Box>
                          </FormControl>
                        </>
                      )}
                    </VStack>
                  </Box>
                )}
                <Flex justify="flex-end" pt={2}>
                  <Button
                    variant="solid"
                    colorScheme="blue"
                    size="lg"
                    isLoading={isLoading}
                    type="submit"
                    minW="140px"
                    leftIcon={<Icon as={FiFilter} />}
                    _hover={{ bg: 'blue.300' }}
                  >
                    Search
                  </Button>
                </Flex>

                {videos?.length > 0 && (
                  <>
                    <Divider borderColor="whiteAlpha.200" pt={4} />
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold" color="gray.400" mb={4}>
                        Found {videos.length} video{videos.length !== 1 ? 's' : ''}
                      </Text>
                      <Box
                        sx={{
                          columnCount: { base: 1, sm: 2, md: 3, lg: 4 },
                          columnGap: '20px',
                          '& > div': {
                            breakInside: 'avoid',
                            marginBottom: '20px'
                          }
                        }}
                      >
                        {videos.map((videoAlternative, index) => (
                          <Box key={index} display="inline-block" width="100%">
                            <Card
                              position="relative"
                              w="100%"
                              h="fit-content"
                              overflow="hidden"
                              _hover={{
                                transform: 'translateY(-2px)',
                                transition: 'transform 0.2s',
                                borderColor: 'blue.200'
                              }}
                            >
                              <FootagePreview
                                videoAlternative={videoAlternative}
                                onSelect={() => {
                                  onFootageSelect([videoAlternative], keywords);
                                  setVideos([]);
                                  onClose();
                                }}
                              />
                            </Card>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </>
                )}

                {videos?.length === 0 && keywords && !isLoading && (
                  <Box
                    textAlign="center"
                    py={12}
                    bg="whiteAlpha.50"
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor="whiteAlpha.100"
                  >
                    <Text color="gray.400" fontSize="md">
                      No videos found for "{keywords}"
                    </Text>
                    <Text color="gray.500" fontSize="sm" mt={2}>
                      Try adjusting your search terms or filters
                    </Text>
                  </Box>
                )}
              </VStack>
            </ModalBody>
          </ModalContent>
        </form>
      </FormProvider>
    </Modal>
  );
};
