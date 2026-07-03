import * as React from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
  Image,
  useColorModeValue,
  VStack,
  useDisclosure,
  TagCloseButton,
  TagLabel,
  Tag,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spinner,
  useToast,
  IconButton
} from '@chakra-ui/react';
import { FaBook, FaFilm, FaSearch, FaVideo } from 'react-icons/fa';
import { useMutation, useQuery } from 'react-query';
import { Controller, useFieldArray, UseFormRegister, useFormState, useFormContext } from 'react-hook-form';
import { ILibrary, UploadFormData, UploadType, Tag as Itag } from '../../types';
import { Link } from 'react-router-dom';
import pexelsLogo from '../../assets/pexels-logo.png';
import { useUserId } from '../../contexts/firebase/hooks';
import { useApiService } from '../../hooks/useApiService';
import { LibraryModal } from './PublicLibraryModal';
import { useEffect } from 'react';
import { MdAutoAwesome } from 'react-icons/md';
import { useUploadScriptsStore } from '../../stores/uploadScriptsStore';
export const LibraryChoice: React.FC<{
  uploadType: UploadType | 'scriptAudio';
  register: UseFormRegister<UploadFormData>;
  script?: string;
  privateLibraryIds?: string[];
  publicLibraryIds?: string[];
}> = React.memo(({ register, uploadType, script: scriptProp, privateLibraryIds = [], publicLibraryIds = [] }) => {
  const {
    fields: libraries,
    replace: replaceLibraries,
    update: updateLibrary
  } = useFieldArray<UploadFormData, 'libraries', '_id'>({
    name: 'libraries'
  });
  const apiService = useApiService();
  const videoScripts = useUploadScriptsStore(state => state.videoScripts);
  const script = scriptProp ?? videoScripts?.find(script => !!script.script)?.script;
  const toast = useToast();
  const { fields: selectedTags, replace: replaceTags } = useFieldArray<UploadFormData, 'selectedTags', 'tag'>({
    name: 'selectedTags'
  });

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { dirtyFields } = useFormState();
  const { setValue, watch } = useFormContext<UploadFormData>();
  const isAllPublicLibrariesSelected = watch('isAllPublicLibrariesSelected');

  const removeTag = (tag: string) => {
    replaceTags(selectedTags.filter(t => t.tag !== tag));
  };

  const autosuggestMutation = useMutation(
    async (script: string) => {
      return await apiService.post<Itag[], { script: string }>(
        '/api/search/autosuggest-public-libraries',
        {
          script
        },
        {}
      );
    },
    {
      onSuccess: data => {
        if (data) {
          replaceTags(data);
        } else {
          toast({
            title: 'No libraries found',
            description: 'No relevant libraries found for your script.',
            status: 'error'
          });
        }
      }
    }
  );
  const bgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const textColor = useColorModeValue('gray.600', 'white');
  const mutedTextColor = useColorModeValue('gray.600', 'whiteAlpha.600');
  const userId = useUserId();
  const { isLoading, isFetching, data } = useQuery({
    queryKey: ['libraries', userId],
    refetchOnMount: 'always',
    enabled: true,
    queryFn: async () => {
      return await apiService.get<ILibrary[]>('/api/library');
    }
  });

  useEffect(() => {
    if (!dirtyFields.libraries?.length && data?.length) {
      replaceLibraries(
        data.map(library => ({
          ...library,
          isSelected: libraries.find(f => f._id === library._id)?.isSelected ?? privateLibraryIds.includes(library._id)
        }))
      );
    }
  }, [data, libraries, replaceLibraries, dirtyFields.libraries, privateLibraryIds]);

  // Pre-populate public library tags if publicLibraryIds are provided
  useEffect(() => {
    const fetchPublicLibraryTags = async () => {
      if (publicLibraryIds.length > 0 && selectedTags.length === 0 && !dirtyFields.selectedTags) {
        try {
          const libraries = await apiService.post<{ _id: string; title: string }[], { libraryIds: string[] }>(
            '/api/library/libraries-by-ids',
            {
              libraryIds: publicLibraryIds
            }
          );

          const tagsWithNames = libraries.map(library => ({
            tag: library.title,
            libraryId: library._id,
            videoCount: 0, // Will be updated when fetched
            screenshots: [] // Will be updated when fetched
          }));

          replaceTags(tagsWithNames);
        } catch (error) {
          console.error('Failed to fetch public library names:', error);
        }
      }
    };

    fetchPublicLibraryTags();
  }, [publicLibraryIds, selectedTags.length, apiService, replaceTags, dirtyFields.selectedTags]);

  if (isLoading || isFetching) {
    return (
      <Box w="100%" py={8} display="flex" justifyContent="center" alignItems="center">
        <Spinner />
      </Box>
    );
  }

  return (
    <Box pt={8} w="100%">
      <Heading as="h1" size="lg" className="source-footage-heading" mb={8} color={textColor}>
        Source footage from
      </Heading>

      <Accordion allowMultiple defaultIndex={libraries?.length ? [0, 1, 2] : [0, 1]}>
        {/* Personal Libraries Section */}
        <AccordionItem border="1px" mb={4} borderRadius="lg" bg={bgColor} borderColor={borderColor}>
          <AccordionButton py={4} as="div">
            <Flex flex="1" align="center" justify="space-between">
              <HStack>
                <Icon as={FaVideo} />
                <Heading as="h2" size="md" color={textColor} className="personal-libraries-heading">
                  Personal Libraries
                </Heading>
              </HStack>
              <HStack spacing={2}>
                {libraries?.length > 0 && (
                  <Button
                    colorScheme="white"
                    size="sm"
                    variant="outline"
                    mr={2}
                    onClick={e => {
                      e.stopPropagation();
                      const allSelected = libraries.every(lib => lib.isSelected);
                      libraries.forEach((field, index) => {
                        updateLibrary(index, { ...field, isSelected: !allSelected });
                      });
                    }}
                  >
                    {libraries.every(lib => lib.isSelected) ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </HStack>
            </Flex>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel pb={4}>
            <Stack direction={['column', 'row']} spacing={6} flexWrap="wrap">
              {libraries?.map((library, index) => (
                <Controller
                  name={`libraries.${index}`}
                  key={library._id}
                  render={field => {
                    return (
                      <Checkbox
                        display="flex"
                        colorScheme="blue"
                        alignItems="center"
                        isChecked={library.isSelected}
                        onChange={event =>
                          updateLibrary(index, { ...field.field.value, isSelected: event.target.checked })
                        }
                      >
                        {library.title}
                        {library.status === 'PROCESSING' && (
                          <Badge colorScheme="blue" ml={2}>
                            Processing
                          </Badge>
                        )}
                      </Checkbox>
                    );
                  }}
                />
              ))}
            </Stack>
            {!libraries?.length ? (
              <Text fontSize="sm" color={mutedTextColor}>
                You have not added any personal libraries. Adding your own footage will greatly improve your results.
              </Text>
            ) : (
              <Text fontSize="sm" color={mutedTextColor} mt={4}>
                Footage will be fetched from selected libraries.
              </Text>
            )}
          </AccordionPanel>
        </AccordionItem>

        {/* Public Libraries Section */}
        <AccordionItem border="1px" borderRadius="lg" mb={4} bg={bgColor} borderColor={borderColor}>
          <AccordionButton py={4}>
            <Flex flex="1" align="center">
              <Icon as={FaBook} mr={2} />
              <Heading as="h2" size="md" color={textColor} className="public-libraries-heading">
                Public Libraries
              </Heading>
            </Flex>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel pb={4}>
            <Stack spacing={4}>
              <Checkbox
                isChecked={isAllPublicLibrariesSelected}
                onChange={async e => {
                  if (e.target.checked && data) {
                    setValue('isAllPublicLibrariesSelected', true, { shouldDirty: true });
                  } else {
                    setValue('isAllPublicLibrariesSelected', false, { shouldDirty: true });
                  }
                }}
              >
                Select All Public Libraries
              </Checkbox>
              <HStack>
                <Button
                  onClick={onOpen}
                  variant="outline"
                  w="full"
                  justifyContent="space-between"
                  bg="transparent"
                  _hover={{ bg: 'gray.800', color: 'white' }}
                >
                  Select Libraries
                  <Icon as={FaSearch} boxSize={4} />
                </Button>
                {(uploadType === 'script' || uploadType === 'prompt') && (
                  <IconButton
                    onClick={() => script && autosuggestMutation.mutate(script)}
                    icon={<Icon as={MdAutoAwesome} boxSize={4} />}
                    variant="outline"
                    isDisabled={!script}
                    isLoading={autosuggestMutation.isLoading}
                    aria-label="Autosuggest"
                    className="autosuggest-public-libraries-button"
                  />
                )}
              </HStack>
              <Flex mt={4} flexWrap="wrap" gap={2}>
                {selectedTags.map(tag => (
                  <Tag key={tag.libraryId} size="md" borderRadius="full" variant="solid" bg="gray.700" color="white">
                    <TagLabel>
                      {tag.tag} {tag.videoCount !== 0 && `(${tag.videoCount})`}
                    </TagLabel>
                    <TagCloseButton
                      onClick={() => {
                        removeTag(tag.tag);
                      }}
                    />
                  </Tag>
                ))}
              </Flex>

              <Text fontSize="sm" color={mutedTextColor}>
                Footage will be filtered based on these tags
              </Text>
            </Stack>
          </AccordionPanel>
        </AccordionItem>

        {/* Stock Footage Section */}
        <AccordionItem border="1px" borderRadius="lg" bg={bgColor} borderColor={borderColor}>
          <AccordionButton py={4}>
            <Flex flex="1" align="center">
              <Icon as={FaFilm} mr={2} />
              <Heading as="h2" size="md" color={textColor} className="stock-footage-heading">
                Stock Footage
              </Heading>
            </Flex>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel pb={4}>
            <VStack align="flex-start">
              {/* <Checkbox {...register('storyblocks')}>Use Storyblocks stock footage</Checkbox> */}
              <Checkbox {...register('pexels')} mt={2} textDecoration="underline">
                <Link to="https://www.pexels.com/videos/" target="_blank">
                  <Image height={8} src={pexelsLogo} alt="Pexels" />
                </Link>
              </Checkbox>
            </VStack>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
      {isOpen && (
        <LibraryModal
          isOpen={isOpen}
          onClose={onClose}
          selectedTags={selectedTags}
          onTagsChange={tags => {
            const existingTagIds = selectedTags.map(tag => tag.libraryId);
            const newTags = tags.filter(tag => !existingTagIds.includes(tag.libraryId));
            const mergedTags = [...selectedTags, ...newTags];
            replaceTags(mergedTags);
          }}
          isAutosuggestEnabled={uploadType === 'script' || uploadType === 'prompt'}
        />
      )}
    </Box>
  );
});
