import React, { useEffect, useState } from 'react';
import {
  Text,
  Badge,
  Heading,
  Container,
  Flex,
  Box,
  VStack,
  Grid,
  Button,
  HStack,
  Stack,
  Progress,
  useDisclosure,
  Tab,
  TabList,
  Tabs,
  TabPanel,
  TabPanels,
  InputGroup,
  InputLeftElement,
  Input,
  Icon,
  IconButton,
  Image,
  Spinner,
  AlertIcon,
  AlertDescription,
  AlertTitle,
  Alert
} from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { FaSearch, FaUpload } from 'react-icons/fa';
import { useApiService } from '../../hooks/useApiService';
import { useLibraryImport } from '../../hooks/useLibraryImport';
import { calculateTotalProgress } from 'shared/utils/misc';
import { useQuery } from 'react-query';
import { IBrollFootageMetadata, ILibrary, Tag } from '../../types';
import { useUserId } from '../../contexts/firebase/hooks';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { WelcomePopup } from '../common/WelcomePopup';
import { getStatusBadgeColor } from '../../utils/library';
import { Pagination } from '../common/Pagination';
import { WalkthroughButton } from '../upload/walkthrough/WalkthroughButton';
import { WalkthroughProvider } from '../upload/walkthrough/WalkthroughProvider';

type PopulatedLibrary = ILibrary & { firstVideo?: IBrollFootageMetadata };

const LibraryItem: React.FC<{ library: PopulatedLibrary }> = ({ library }) => {
  const navigate = useNavigate();
  return (
    <Box
      borderRadius="md"
      overflow="hidden"
      borderColor="whiteAlpha.200"
      borderWidth={1}
      bg="whiteAlpha.100"
      transition="all 0.3s"
      _hover={{ bg: 'whiteAlpha.200' }}
      onClick={() => navigate(`/libraries/${library._id}`)}
    >
      <VStack align="stretch" h="full">
        <VStack align="stretch" p={4}>
          <Flex justifyContent="space-between" alignItems="center">
            <Heading as="h3" size="md" color="white">
              <Link to={`/libraries/${library._id}`} style={{ textDecoration: 'none' }}>
                {library.title || 'Untitled'}
              </Link>
            </Heading>
            <HStack>
              {library.status !== 'PROCESSED' && (
                <Badge colorScheme={getStatusBadgeColor(library.status)}>{library.status}</Badge>
              )}
              {library.isPublic && <Badge colorScheme="green">Public</Badge>}
            </HStack>
          </Flex>

          {library.status === 'PROCESSING' && (library.asyncProgress || library.progress) && (
            <>
              <Progress value={calculateTotalProgress(library)} />
              <Text textAlign="right" color="whiteAlpha.600" fontSize="xs">
                {Math.round(calculateTotalProgress(library) * 100) / 100}%
              </Text>
            </>
          )}
        </VStack>

        <HStack p={4} justifyContent="flex-end">
          <Link
            to={`/libraries/${library._id}/add`}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              if (library.status === 'PROCESSING') {
                return;
              }
              navigate(`/libraries/${library._id}/add`);
            }}
          >
            <Button colorScheme="white" size="sm" isDisabled={library.status !== 'PROCESSED'}>
              + Add to Library
            </Button>
          </Link>
        </HStack>
      </VStack>
    </Box>
  );
};

const PublicLibraryCard: React.FC<{
  tag: string;
  videoCount: number;
  images: string[];
  libraryId: string | null;
}> = ({ tag, videoCount, images, libraryId }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

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
      onClick={() => navigate(`/libraries/${libraryId}`)}
      transition="all 0.2s"
      _hover={{ bg: 'whiteAlpha.200' }}
      onMouseEnter={() => {
        setCurrentImageIndex(v => (v + 1) % images.length);
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="public-library-card"
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
          </Flex>
          <Text color="gray.400" fontSize="sm">
            ({videoCount})
          </Text>
        </Box>
      </Flex>
    </Box>
  );
};

const LibraryList: React.FC = () => {
  const apiService = useApiService();
  const userId = useUserId();
  const [tabIndex, setTabIndex] = useState(0);
  const [shouldAutoStart] = useState(false);
  const { isImporting, fileInputRef, openFilePicker, handleFileChange } = useLibraryImport();

  // Personal libraries query
  const { data: libraries, isLoading } = useQuery(
    ['libraries', userId],
    async () => {
      const response = await apiService.get<PopulatedLibrary[]>('/api/library');
      return response;
    },
    {
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
      retry: false
    }
  );

  // Public libraries state and query
  const [publicSearchQuery, setPublicSearchQuery] = useState('');
  const [publicCurrentPage, setPublicCurrentPage] = useState(0);

  const {
    data: publicTags,
    isLoading: isPublicTagsLoading,
    refetch: refetchPublicTags
  } = useQuery({
    queryKey: ['public-tags', userId, publicCurrentPage],
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: tabIndex === 1, // Only fetch when public tab is active
    cacheTime: 0, // Immediately remove from cache when component unmounts
    queryFn: async () => {
      const response = await apiService.get<{ tags: Tag[]; total: number }>(
        `/api/library/tags?skip=${publicCurrentPage * 12}&limit=12&search=${publicSearchQuery}`
      );
      return response;
    }
  });
  const totalPublicTags = publicTags?.total || 0;

  const { isOpen, onOpen, onClose } = useDisclosure();
  useEffect(() => {
    if (!false && false) {
      onOpen();
    }
  }, [onOpen]);

  if (isLoading) {
    return <GlobalSpinner />;
  }
  return (
    <WalkthroughProvider>
      <Container w="100%" maxW={{ base: '100%', md: '800px', lg: '1000px', xl: '1200' }} pb={10}>
        <Tabs variant="soft-rounded" colorScheme="gray" index={tabIndex} onChange={setTabIndex}>
          <Stack justifyContent="space-between" flexDirection={{ base: 'column', md: 'row' }}>
            <Heading mb={{ base: 4, md: 12 }} mt="10">
              Libraries
            </Heading>
            <HStack mb={{ base: 12, md: 0 }}>
              <WalkthroughButton walkthroughType="libraryList" isSample={shouldAutoStart} />
              <input
                type="file"
                accept=".zip,.json"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                hidden
              />
              <Button
                leftIcon={<FaUpload />}
                size="sm"
                variant="outline"
                colorScheme="white"
                onClick={openFilePicker}
                isLoading={isImporting}
                loadingText="Importing"
              >
                Import Library
              </Button>
              <TabList borderColor="gray.700" gap={2}>
                <Tab p={0} fontWeight="bold" as="div">
                  <Button
                    children="Personal"
                    aria-label="Personal"
                    size="sm"
                    variant={tabIndex === 0 ? 'solid' : 'outline'}
                    colorScheme="white"
                    w="120px"
                  />
                </Tab>
                <Tab p={0} fontWeight="bold" as="div">
                  <Button
                    children="Public"
                    aria-label="Public"
                    size="sm"
                    variant={tabIndex === 1 ? 'solid' : 'outline'}
                    colorScheme="white"
                    w="120px"
                  />
                </Tab>
              </TabList>
            </HStack>
          </Stack>
          <Box>
            <WelcomePopup isOpen={isOpen} onClose={onClose} />
            <TabPanels>
              <TabPanel p={0}>
                {libraries?.some(
                  library =>
                    library.status === 'PROCESSING' || library.status === 'QUEUED' || library.status === 'TAGGING'
                ) && (
                  <Alert status="info" mb={6} variant="subtle" borderRadius="xl">
                    <AlertIcon />
                    <Box>
                      <AlertTitle color="white">Library Processing</AlertTitle>
                      <AlertDescription color="whiteAlpha.800">
                        <Text fontWeight="bold" as="span">
                          Library population can take up to 45 minutes.{' '}
                        </Text>
                        The process is asynchronous and will continue in the background. You can continue to use the app
                        while the library is being populated. We will send you an email when everything is ready.
                      </AlertDescription>
                    </Box>
                  </Alert>
                )}
                {libraries?.some(library => library.status === 'QUEUED') && (
                  <Alert status="info" mb={6} variant="subtle" borderRadius="xl">
                    <AlertIcon />
                    <Box>
                      <AlertTitle color="white">Library Queued</AlertTitle>
                      <AlertDescription color="whiteAlpha.800">
                        <Text fontWeight="bold" as="span">
                          Your library is queued for processing.
                        </Text>{' '}
                        We are experiencing high demand for our service. Please be patient while we process your
                        library.
                      </AlertDescription>
                    </Box>
                  </Alert>
                )}
                {libraries?.length ? (
                  <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={6}>
                    {libraries?.map(library => (
                      <LibraryItem key={library._id} library={library} />
                    ))}
                  </Grid>
                ) : (
                  <Text>
                    You have not created any libraries yet.{' '}
                    <Text as="span" color="white" textDecoration="underline">
                      <Link to="/library/add">Create a library</Link>
                    </Text>
                  </Text>
                )}
              </TabPanel>
              <TabPanel p={0}>
                <VStack spacing={4} align="stretch" mb={6}>
                  <Flex gap={2}>
                    <InputGroup flex="1">
                      <InputLeftElement pointerEvents="none">
                        <Icon as={FaSearch} color="gray.400" />
                      </InputLeftElement>
                      <Input
                        placeholder="Search public libraries..."
                        bg="transparent"
                        borderColor="whiteAlpha.200"
                        value={publicSearchQuery}
                        onChange={e => setPublicSearchQuery(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            refetchPublicTags();
                          }
                        }}
                      />
                    </InputGroup>
                    <IconButton
                      aria-label="Search public libraries"
                      icon={<FaSearch />}
                      variant="outline"
                      borderColor="whiteAlpha.200"
                      _hover={{ bg: 'whiteAlpha.100' }}
                      onClick={() => refetchPublicTags()}
                      isLoading={isPublicTagsLoading}
                    />
                  </Flex>

                  <Box>
                    {isPublicTagsLoading ? (
                      <Flex justify="center" align="center" h="200px">
                        <Spinner />
                      </Flex>
                    ) : (
                      <>
                        {totalPublicTags > 0 ? (
                          <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={6}>
                            {publicTags?.tags.map(tag => (
                              <PublicLibraryCard
                                key={tag.tag + tag.videoCount}
                                tag={tag.tag}
                                videoCount={tag.videoCount}
                                images={tag.screenshots}
                                libraryId={tag.libraryId}
                              />
                            ))}
                          </Grid>
                        ) : (
                          <Flex justify="center" align="center" w="100%" h="200px">
                            <Text>No public libraries found.</Text>
                          </Flex>
                        )}
                        {totalPublicTags > 12 && (
                          <Flex justify="center" mt={6}>
                            <Pagination
                              currentPage={publicCurrentPage}
                              pageSize={12}
                              total={totalPublicTags}
                              handlePageChange={setPublicCurrentPage}
                            />
                          </Flex>
                        )}
                      </>
                    )}
                  </Box>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Box>
        </Tabs>
      </Container>
    </WalkthroughProvider>
  );
};

export default LibraryList;
