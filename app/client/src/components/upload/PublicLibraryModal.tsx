'use client';

import { useState, useEffect, memo } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Box,
  VStack,
  InputGroup,
  InputLeftElement,
  Input,
  Flex,
  Text,
  Icon,
  Grid,
  Button,
  Image,
  IconButton,
  useToast,
  Spinner,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody
} from '@chakra-ui/react';
import { FaSearch, FaCheck, FaExternalLinkAlt } from 'react-icons/fa';
import { Tag as ITag } from '../../types';
import { useMutation, useQuery } from 'react-query';
import { useApiService } from '../../hooks/useApiService';
import { useUserId } from '../../contexts/firebase/hooks';
import { Pagination } from '../common/Pagination';
import { Link } from 'react-router-dom';
import { MdAutoAwesome } from 'react-icons/md';
import { useUploadScriptsStore } from '../../stores/uploadScriptsStore';

const LibraryCard: React.FC<{
  tag: string;
  videoCount: number;
  images: string[];
  isSelected: boolean;
  libraryId: string | null;
  onClick: () => void;
}> = memo(({ tag, videoCount, images, isSelected, libraryId, onClick }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!isHovered) return;
    const interval = setInterval(() => {
      setCurrentImageIndex(prevIndex => (prevIndex + 1) % images.length);
    }, 1000);
    return () => clearInterval(interval);
  }, [isHovered, images.length]);

  return (
    <Box
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      borderRadius="md"
      overflow="hidden"
      bg="whiteAlpha.100"
      cursor="pointer"
      onClick={onClick}
      transition="all 0.2s"
      _hover={{ bg: 'whiteAlpha.200' }}
      onMouseEnter={() => {
        setCurrentImageIndex(v => (v + 1) % images.length);
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Box position="relative" h="140px" overflow="hidden">
        {images.map((image, index) => (
          <Image
            key={index}
            src={image || '/placeholder.png'}
            alt={`${tag} preview ${index + 1}`}
            position="absolute"
            top="0"
            left="0"
            w="100%"
            h="100%"
            objectFit="cover"
            opacity={index === currentImageIndex ? 1 : 0}
            transition="opacity 1s ease-in-out"
          />
        ))}
      </Box>
      <Flex justify="space-between" align="center" p={3}>
        <Box>
          <Flex align="center" gap={2} justify="space-between">
            <Text fontWeight="medium">{tag}</Text>
            <IconButton
              aria-label="Open in new window"
              size="sm"
              icon={<FaExternalLinkAlt />}
              variant="outline"
              borderColor="whiteAlpha.200"
              as={Link}
              to={`/libraries/${libraryId}`}
              target="_blank"
            ></IconButton>
          </Flex>
          <Text color="gray.400" fontSize="sm">
            ({videoCount})
          </Text>
        </Box>
        {isSelected && <Icon as={FaCheck} color="green.500" boxSize={4} />}
      </Flex>
    </Box>
  );
});

export function LibraryModal({
  isOpen,
  onClose,
  selectedTags = [],
  onTagsChange,
  isAutosuggestEnabled = false
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedTags: ITag[];
  onTagsChange: (tags: ITag[]) => void;
  isAutosuggestEnabled?: boolean;
}) {
  const videoScripts = useUploadScriptsStore(state => state.videoScripts);
  const script = videoScripts?.find(script => !!script.script)?.script;

  const [localTags, setLocalTags] = useState<(ITag & { isSelected: boolean })[]>([]);
  const apiService = useApiService();
  const [currentPage, setCurrentPage] = useState(0);
  const [totalTags, setTotalTags] = useState(0);
  const [selectedLocalTags, setSelectedLocalTags] = useState<ITag[]>(selectedTags);
  const userId = useUserId();
  const {
    isFetching: isTagsLoading,
    refetch,
    data
  } = useQuery({
    queryKey: ['tags', userId, currentPage],
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      return await apiService.get<{ tags: ITag[]; total: number }>(
        `/api/library/tags?skip=${currentPage * 12}&limit=12&search=${searchQuery}`
      );
    },
    onSuccess: data => {
      if (data.tags.length === 0) {
        toast({
          title: 'No libraries found',
          description: 'No relevant libraries found for your search criteria.',
          status: 'warning'
        });
      }
    }
  });

  const autosuggestMutation = useMutation(
    async (script: string) => {
      return await apiService.post<ITag[], { script: string }>(
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
          setLocalTags(data.map(tag => ({ ...tag, isSelected: true })));
          setTotalTags(data.length);
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

  useEffect(() => {
    if (data) {
      setLocalTags(
        autosuggestMutation.data
          ? autosuggestMutation.data.map(tag => ({ ...tag, isSelected: true }))
          : data.tags.map(tag => ({ ...tag, isSelected: selectedLocalTags.some(t => t.libraryId === tag.libraryId) }))
      );
      setSelectedLocalTags(autosuggestMutation.data ? autosuggestMutation.data : selectedLocalTags);
      setTotalTags(autosuggestMutation.data ? autosuggestMutation.data.length : data.total);
    }
  }, [data, selectedLocalTags, autosuggestMutation.data]);

  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();

  const toggleTag = (tag: ITag) => {
    setSelectedLocalTags(prev =>
      prev.find(t => t.libraryId === tag.libraryId) ? prev.filter(t => t.libraryId !== tag.libraryId) : [...prev, tag]
    );
  };

  const handleSave = () => {
    if (onTagsChange) {
      onTagsChange(selectedLocalTags);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="4xl">
      <ModalOverlay bg="blackAlpha.800" />
      <ModalContent maxW={{ base: '90%', md: '900px' }}>
        <Box bg="whiteAlpha.100">
          <ModalHeader fontSize="xl">Select Libraries</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Flex gap={2}>
                <InputGroup flex="1">
                  <InputLeftElement pointerEvents="none">
                    <Icon as={FaSearch} color="gray.400" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search libraries..."
                    bg="transparent"
                    borderColor="whiteAlpha.200"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        refetch();
                        autosuggestMutation.reset();
                      }
                    }}
                  />
                </InputGroup>
                <IconButton
                  aria-label="Search libraries"
                  icon={<FaSearch />}
                  variant="outline"
                  borderColor="whiteAlpha.200"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  onClick={() => {
                    refetch();
                    autosuggestMutation.reset();
                  }}
                  isLoading={isTagsLoading}
                />

                {isAutosuggestEnabled && (
                  <Popover trigger="hover" placement="left" isOpen={!script ? undefined : false}>
                    <PopoverTrigger>
                      <span>
                        <IconButton
                          aria-label="Autosuggest libraries"
                          icon={<MdAutoAwesome />}
                          variant="outline"
                          borderColor="whiteAlpha.200"
                          _hover={{ bg: 'whiteAlpha.100' }}
                          isDisabled={!script}
                          onClick={() => autosuggestMutation.mutate(script ?? '')}
                          isLoading={autosuggestMutation.isLoading}
                          tabIndex={!script ? 0 : undefined}
                        />
                      </span>
                    </PopoverTrigger>
                    <PopoverContent
                      bg="black"
                      color="white"
                      borderColor="whiteAlpha.200"
                      pointerEvents="none"
                      width="auto"
                      _focus={{ boxShadow: 'none' }}
                    >
                      <PopoverArrow bg="black" />
                      <PopoverBody>You need to input at least one script to use this feature.</PopoverBody>
                    </PopoverContent>
                  </Popover>
                )}
              </Flex>

              <Box maxH="500px" overflowY="auto" w="full" pr={2}>
                {isTagsLoading ? (
                  <Flex justify="center" align="center" h="200px">
                    <Spinner />
                  </Flex>
                ) : (
                  <>
                    {localTags.length ? (
                      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={4}>
                        {localTags.map(tag => (
                          <LibraryCard
                            key={tag.tag + tag.videoCount}
                            tag={tag.tag}
                            videoCount={tag.videoCount}
                            images={tag.screenshots}
                            isSelected={tag.isSelected}
                            libraryId={tag.libraryId}
                            onClick={() => toggleTag(tag)}
                          />
                        ))}
                      </Grid>
                    ) : (
                      <Flex justify="center" align="center" w="100%" h="200px">
                        <Text>No libraries found.</Text>
                      </Flex>
                    )}
                    {totalTags > 12 && (
                      <Flex justify="center" mt={4}>
                        <Pagination
                          currentPage={currentPage}
                          pageSize={12}
                          total={totalTags}
                          handlePageChange={setCurrentPage}
                        />
                      </Flex>
                    )}
                  </>
                )}
              </Box>

              <Flex justify="flex-end" pt={4}>
                <Button variant="outline" mr={3} onClick={onClose} borderColor="whiteAlpha.200">
                  Cancel
                </Button>
                <Button colorScheme="blue" onClick={handleSave}>
                  Select
                </Button>
              </Flex>
            </VStack>
          </ModalBody>
        </Box>
      </ModalContent>
    </Modal>
  );
}
