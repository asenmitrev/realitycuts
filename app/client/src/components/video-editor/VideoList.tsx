'use client';

import { type FC, Fragment, useMemo, useEffect, useState, memo } from 'react';
import type { ExportJob, TranscriptionJob, VideoAIData } from '../../types';
import 'rc-slider/assets/index.css';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Image,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  Container,
  useToast,
  Box,
  Flex,
  Input,
  Badge,
  Text,
  HStack,
  useDisclosure,
  IconButton,
  List,
  ListItem,
  AspectRatio
} from '@chakra-ui/react';
import { useApiService } from '../../hooks/useApiService';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { FaSave } from 'react-icons/fa';
import { BsList, BsGrid } from 'react-icons/bs';
import { useQuery, useQueryClient } from 'react-query';
import { useConfirmDialogV2 } from '../../hooks/useConfirmDialog';
import { WelcomePopup } from '../common/WelcomePopup';
import { useUserId } from '../../contexts/firebase/hooks';
import { FaPlay } from 'react-icons/fa';
import { Pagination } from '../common/Pagination';
import { WalkthroughProvider } from '../upload/walkthrough/WalkthroughProvider';
import { WalkthroughButton } from '../upload/walkthrough/WalkthroughButton';

// const mockSampleData: VideoAIData[] = [
// {
//   _id: '1',
//   title: 'The Solar System',
//   image: '/sample-ss.png',
//   segments: [
//     {
//       alternatives: [{ text: 'Hello, world!', isFocused: true }],
//       start: 0,
//       end: 100
//     }
//   ],
//   transcriptionJob: { jobType: 'SCRIPT' },
//   source: { metadata: { format: { duration: 100 } }, thumbnail: '/sample-ss.png' }
// } as unknown as VideoAIData,
// {
//   _id: '2',
//   title: 'World War 2',
//   image: '/sample-ww2.png',
//   segments: [
//     {
//       alternatives: [{ text: 'Hello, world!', isFocused: true }],
//       start: 0,
//       end: 100
//     }
//   ],
//   transcriptionJob: { jobType: 'SCRIPT' },
//   source: { metadata: { format: { duration: 100 } }, thumbnail: '/sample-ww2.png' }
// } as unknown as VideoAIData
// ];

export type PopulatedTranscriptionJob = TranscriptionJob & {
  videoAIData?: VideoAIData[];
  exportJobs?: ExportJob[];
};

// Helper function to find the first segment with a selected alternative that has a thumbnail URL
const findThumbnailUrl = (data: VideoAIData): string | undefined => {
  // First try to find a segment with an alternative that has isFocused=true and a thumbnailUrl
  const focusedSegment = data.segments.find(segment =>
    segment?.alternatives?.some(alt => alt.isFocused && alt.thumbnailUrl)
  );

  if (focusedSegment) {
    return focusedSegment.alternatives.find(alt => alt.isFocused && alt.thumbnailUrl)?.thumbnailUrl;
  }

  // If no focused alternative with thumbnail found, find any segment with an alternative that has a thumbnailUrl
  const segmentWithThumbnail = data.segments.find(segment => segment?.alternatives?.some(alt => alt.thumbnailUrl));

  if (segmentWithThumbnail) {
    return segmentWithThumbnail.alternatives.find(alt => alt.thumbnailUrl)?.thumbnailUrl;
  }

  // Fallback to the first segment's first alternative's thumbnailUrl (existing behavior)
  return data.segments[0]?.alternatives[0]?.thumbnailUrl ?? '/placeholder.png';
};

interface VideoCardProps {
  data: VideoAIData;
  exportJobs?: ExportJob[];
  onDelete?: (id: string) => void;
  onEdit?: (id: string, video: VideoAIData) => void;
  jobType: TranscriptionJob['jobType'];
  viewMode: 'grid' | 'list';
  isSample?: boolean;
  isAiThumbnail?: boolean;
  sampleId?: string;
  sampleImage?: string;
}

const getDurationSeconds = (data: VideoAIData): number | undefined => {
  const fromSource = data.source?.metadata?.format?.duration;
  if (typeof fromSource === 'number' && Number.isFinite(fromSource) && fromSource > 0) return fromSource;
  
  const fromTranscript =
    data.editedWordsList?.length ? Math.max(...data.editedWordsList.map(w => w.end).filter(e => typeof e === 'number' && e > 0)) : undefined;
  if (typeof fromTranscript === 'number' && Number.isFinite(fromTranscript) && fromTranscript > 0) return fromTranscript;

  const fromSegments = data.segments?.length ? Math.max(...data.segments.map(s => s.timeEnd)) : undefined;
  if (typeof fromSegments === 'number' && Number.isFinite(fromSegments) && fromSegments > 0) return fromSegments;

  // Audio-only videos may not have a `source` or ffprobe metadata; use audio track duration if available.
  const fromAudioIndex = data.audio?.[data.audioIndex]?.duration;
  if (typeof fromAudioIndex === 'number' && Number.isFinite(fromAudioIndex) && fromAudioIndex > 0) return fromAudioIndex;

  const fromAnyAudio =
    data.audio?.length ? Math.max(...data.audio.map(a => a.duration).filter(d => typeof d === 'number' && d > 0)) : undefined;
  if (typeof fromAnyAudio === 'number' && Number.isFinite(fromAnyAudio) && fromAnyAudio > 0) return fromAnyAudio;

  return undefined;
};

export const VideoCard: FC<VideoCardProps> = memo(
  ({ data, exportJobs, onEdit, viewMode = 'card', isAiThumbnail, isSample, sampleId, sampleImage }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(data.title);
    const [isHovering, setIsHovering] = useState(false);
    const [isCloning, setIsCloning] = useState(false);
    const navigate = useNavigate();
    const apiService = useApiService();
    const duration = getDurationSeconds(data);

    const link = isSample ? `/upload?type=script&sample=true` : `/videos/${data._id}`;

    const badge = useMemo(() => {
      if (!exportJobs || exportJobs.length === 0) return null;
      const exportJob = exportJobs.sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      )[0];

      return exportJob?.status === 'COMPLETED' ? (
        <Badge bg="green.500" color="white" fontSize="xs">
          <Link to={`/exports/${exportJob._id}`}>Exported</Link>
        </Badge>
      ) : exportJob?.status === 'PROCESSING' ? (
        <Badge bg="blue.500" color="white" fontSize="xs">
          Exporting
        </Badge>
      ) : exportJob?.status === 'QUEUED' ? (
        <Badge bg="yellow.500" color="white" fontSize="xs">
          Queued
        </Badge>
      ) : null;
    }, [exportJobs]);

    const editVideo = async () => {
      setIsSaving(true);
      try {
        await onEdit?.(data._id, {
          ...data,
          title: editedTitle
        });
      } finally {
        setIsSaving(false);
        setIsEditing(false);
      }
    };

    // Handler for Try Sample
    const handleTrySample = async (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setIsCloning(true);
      try {
        const response = await apiService.post<{ _id: string }>(
          `/api/videos/${sampleId ?? '6864e3ce1dd56a5ef9f9102a'}/clone-sample`,
          undefined
        );
        if (response && response._id) {
          navigate(`/videos/${response._id}`);
        }
      } catch (err) {
        // Optionally show error toast
      } finally {
        setIsCloning(false);
      }
    };

    if (viewMode === 'list') {
      return (
        <Card
          overflow="hidden"
          direction="row"
          variant="outline"
          bg="whiteAlpha.100"
          color="white"
          borderRadius="lg"
          _hover={{ bg: 'gray.800' }}
          transition="background 0.2s"
          cursor="pointer"
          onClick={e => (isSample ? handleTrySample(e) : navigate(link))}
        >
          <Box
            position="relative"
            w="160px"
            h="60px"
            flexShrink={0}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <Image
              src={
                isAiThumbnail ? data.source?.thumbnail :
                  data.transcriptionJob?.jobType !== 'B_ROLL'
                    ? isSample
                      ? sampleImage ?? '/sample-thumbnail.png'
                      : findThumbnailUrl(data)
                    : data.source?.thumbnail
              }
              alt="Video thumbnail."
              objectFit="cover"
              w="100%"
              willChange="transform"
              h="100%"
            />
            {duration && (
              <Box position="absolute" top={1} right={1}>
                <Badge bg="blackAlpha.700" color="white" fontSize="xs" px={1}>
                  {Math.floor(duration / 60)}:
                  {Math.floor(duration % 60)
                    .toString()
                    .padStart(2, '0')}
                </Badge>
              </Box>
            )}
            {isHovering && (
              <Flex position="absolute" inset="0" bg="blackAlpha.60" alignItems="center" justifyContent="center">
                <IconButton
                  aria-label="Play video"
                  icon={<FaPlay />}
                  isRound
                  size="sm"
                  bg="whiteAlpha.300"
                  _hover={{ bg: 'whiteAlpha.400' }}
                />
              </Flex>
            )}
          </Box>
          <CardBody py={3} px={4} display="flex" flexDirection="column" justifyContent="center">
            <Flex justifyContent="space-between" alignItems="center">
              {!isEditing ? (
                <Heading
                  size="md"
                  fontSize="16px"
                  fontWeight="medium"
                  noOfLines={1}
                  _hover={{ textDecoration: 'underline' }}
                >
                  <Link to={link}>{data.title ?? 'Untitled'}</Link>
                </Heading>
              ) : (
                <Flex gap={3} alignItems="center" flex={1}>
                  <Input onChange={e => setEditedTitle(e.target.value)} value={editedTitle} size="sm" />
                  <Button colorScheme="white" variant="ghost" size="sm" isLoading={isSaving}>
                    <FaSave onClick={editVideo} />
                  </Button>
                </Flex>
              )}
              <HStack gap={1} alignItems="center">
                {badge}
              </HStack>
            </Flex>

            {/* Try Sample Button for List View */}
            {isSample && (
              <Button
                size="xs"
                mt={2}
                alignSelf="flex-end"
                bgGradient="linear(to-r, purple.500, blue.500)"
                _hover={{ bgGradient: 'linear(to-r, purple.600, blue.600)' }}
                color="white"
                isLoading={isCloning}
                onClick={handleTrySample}
              >
                Try Sample
              </Button>
            )}
          </CardBody>
        </Card>
      );
    }

    return (
      <Card
        overflow="hidden"
        bg="whiteAlpha.100"
        color="white"
        borderRadius="lg"
        onClick={e => (isSample ? handleTrySample(e) : navigate(link))}
      >
        <Box
          display="flex"
          alignItems="stretch"
          justifyContent="stretch"
          position="relative"
          borderRadius={0}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <AspectRatio ratio={16 / 9} width="100%">
            <Image
              src={
                isAiThumbnail ? data.source?.thumbnail :
                  data.transcriptionJob?.jobType !== 'B_ROLL'
                    ? isSample
                      ? sampleImage ?? '/sample-thumbnail.png'
                      : findThumbnailUrl(data)
                    : data.source?.thumbnail
              }
              alt="Video thumbnail."
              objectFit="cover"
              w="full"
              willChange="transform"
              h="full"
            />
          </AspectRatio>

          {isHovering && (
            <Flex position="absolute" inset="0" bg="blackAlpha.60" alignItems="center" justifyContent="center">
              <IconButton
                aria-label="Play video"
                icon={<FaPlay />}
                isRound
                size="lg"
                bg="whiteAlpha.300"
                _hover={{ bg: 'whiteAlpha.400' }}
              />
            </Flex>
          )}

          <Box position="absolute" top={2} right={4} display="flex" alignItems="center" gap={1}>
            {badge}
          </Box>
          {duration && (
            <Box position="absolute" bottom={2} right={4}>
              <Badge bg="blackAlpha.700" color="white">
                {Math.floor(duration / 60)}:
                {Math.floor(duration % 60)
                  .toString()
                  .padStart(2, '0')}
              </Badge>
            </Box>
          )}
        </Box>
        <CardBody display="flex" flexDirection="column">
          <Heading
            size="md"
            fontSize="20px"
            fontFamily="IBM Plex Sans Hebrew, sans-serif"
            _hover={{ textDecoration: 'underline' }}
            noOfLines={2}
            mb={3}
          >
            {!isEditing ? (
              <>
                {isSample ? (
                  <Text color="white" mb={4}>
                    {data.title ?? 'Untitled'}
                  </Text>
                ) : (
                  <Link to={link}>{data.title ?? 'Untitled'}</Link>
                )}
              </>
            ) : (
              <Flex gap={3} alignItems="center">
                <Input onChange={e => setEditedTitle(e.target.value)} value={editedTitle} />
                <Button colorScheme="white" variant="ghost" size="md" fontSize="larger" isLoading={isSaving}>
                  <FaSave onClick={editVideo} />
                </Button>
              </Flex>
            )}
          </Heading>

          {/* Try Sample Button */}
          {isSample && (
            <>
              <Text fontSize="sm" color="whiteAlpha.700" mb={4}>
                Not sure what to create? Try our sample video first.
              </Text>
              <Button
                bgGradient="linear(to-r, purple.500, blue.500)"
                _hover={{ bgGradient: 'linear(to-r, purple.600, blue.600)' }}
                color="white"
                size="md"
                width="100%"
                isLoading={isCloning}
                onClick={handleTrySample}
              >
                Try Sample
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    );
  }
);

interface UploadCardProps {
  data: TranscriptionJob;
  viewMode: 'grid' | 'list';
}

export const UploadCard: FC<UploadCardProps> = memo(({ data, viewMode }) => {
  if (viewMode === 'list') {
    return (
      <Card
        overflow="hidden"
        direction="row"
        variant="outline"
        bg="whiteAlpha.100"
        color="white"
        borderRadius="lg"
        _hover={{ bg: 'gray.800' }}
        transition="background 0.2s"
        cursor="pointer"
      >
        <Box position="relative" w="160px" h="60px" flexShrink={0}>
          <Image
            src={data.thumbnailUrl || '/placeholder.png'}
            alt="Video thumbnail."
            objectFit="cover"
            w="100%"
            h="100%"
          />
        </Box>
        <CardBody py={3} px={4} display="flex" flexDirection="column" justifyContent="center">
          <Flex justifyContent="space-between" alignItems="center">
            <Heading
              size="md"
              fontSize="16px"
              fontWeight="medium"
              noOfLines={1}
              _hover={{ textDecoration: 'underline' }}
            >
              <Link to={`/upload-progress/${data._id}`}>{data.title ?? 'Untitled'}</Link>
            </Heading>
            <Badge ml={2} colorScheme={data.status === 'FAILED' ? 'red' : 'blue'} fontSize="xs">
              {data.status === 'FAILED'
                ? 'Failed'
                : data.status === 'INSUFFICIENT_FOOTAGE'
                  ? 'Insufficient Footage'
                  : 'In Progress'}
            </Badge>
          </Flex>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card overflow="hidden" bg="whiteAlpha.100" color="white" borderRadius="lg">
      <Box display="flex" alignItems="stretch" justifyContent="stretch" position="relative" borderRadius={0}>
        <Box cursor="pointer" w="100%">
          <Image
            src={data.thumbnailUrl || '/placeholder.png'}
            alt="Video thumbnail."
            objectFit="cover"
            w="100%"
            h="200px"
          />
        </Box>
        <Box position="absolute" top={2} right={4}>
          <Badge colorScheme={data.status === 'FAILED' ? 'red' : 'blue'}>
            {data.status === 'FAILED'
              ? 'Failed'
              : data.status === 'INSUFFICIENT_FOOTAGE'
                ? 'Insufficient Footage'
                : 'In Progress'}
          </Badge>
        </Box>
      </Box>
      <CardBody display="flex" flexDirection="column">
        <Heading
          size="md"
          fontSize="20px"
          fontFamily="IBM Plex Sans Hebrew, sans-serif"
          _hover={{ textDecoration: 'underline' }}
        >
          <Link to={`/upload-progress/${data._id}`}>{data.title ?? 'Untitled'}</Link>
        </Heading>
      </CardBody>
    </Card>
  );
});

interface VideoListProps {
  data: PopulatedTranscriptionJob[];
  onDelete?: (id: string) => void;
  onEdit?: (id: string, title: VideoAIData) => void;
  viewMode: 'grid' | 'list';
}

export const VideoList: FC<VideoListProps> = ({ data, onDelete, onEdit, viewMode }) => {
  if (viewMode === 'list') {
    return (
      <List spacing={3}>
        {data.map(d => (
          <ListItem key={d._id}>
            {d.videoAIData?.[0] ? (
              <VideoCard
                exportJobs={d.exportJobs}
                onDelete={onDelete}
                onEdit={onEdit}
                data={d.videoAIData[0]}
                viewMode={viewMode}
                jobType={d.jobType}
                isAiThumbnail={d?.isAiThumbnail ?? false}
              />
            ) : (
              <UploadCard key={d._id} data={d} viewMode={viewMode} />
            )}
          </ListItem>
        ))}
      </List>
    );
  }

  return (
    <SimpleGrid spacing={4} spacingY={10} columns={{ base: 1, md: 2, xl: 3 }}>
      {data.map(d => (
        <Fragment key={d._id}>
          {d.videoAIData?.[0] ? (
            <VideoCard
              exportJobs={d.exportJobs}
              onDelete={onDelete}
              onEdit={onEdit}
              data={d.videoAIData[0]}
              viewMode={viewMode}
              jobType={d.jobType}
              isAiThumbnail={d?.isAiThumbnail ?? false}
            />
          ) : (
            <UploadCard key={d._id} data={d} viewMode={viewMode} />
          )}
        </Fragment>
      ))}
    </SimpleGrid>
  );
};

const PAGE_SIZE = 15;
const VideoListPageContent: FC = () => {
  const apiService = useApiService();
  const toast = useToast();
  const userId = useUserId();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get('page')) || 0;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const savedViewMode = localStorage.getItem('videoListViewMode');
    return savedViewMode === 'list' || savedViewMode === 'grid' ? savedViewMode : 'grid';
  });

  useEffect(() => {
    localStorage.setItem('videoListViewMode', viewMode);
  }, [viewMode]);

  const { dialogContent, awaitConfirmation } = useConfirmDialogV2({ title: 'Delete Video', type: 'delete' });
  const { isLoading, data: videos } = useQuery({
    queryKey: ['videoList', userId, currentPage],
    queryFn: async () => {
      return await apiService.get<{ videos: PopulatedTranscriptionJob[]; total: number }>(
        `/api/videos?skip=${currentPage * PAGE_SIZE}&limit=${PAGE_SIZE}`
      );
    },
    refetchOnWindowFocus: true,
    refetchOnMount: 'always'
  });
  const { isOpen, onClose } = useDisclosure();

  const queryClient = useQueryClient();

  const deleteVideo = async (id: string) => {
    try {
      await awaitConfirmation();
      await apiService.delete(`/api/videos/${id}`);
      queryClient.setQueryData<{ videos: VideoAIData[]; total: number } | undefined>(['videoList', userId], oldData => {
        if (!oldData) return undefined;
        return {
          ...oldData,
          videos: oldData.videos.filter(v => v._id !== id)
        };
      });
    } catch (error) {
      const err = error as { message?: string };
      toast({
        title: 'Error!',
        description: err.message ?? 'An error occurred deleting your upload.',
        status: 'error',
        duration: 2000,
        isClosable: true
      });
    }
  };

  const editVideo = async (id: string, data: VideoAIData) => {
    await apiService.put(`/api/videos/${id}`, data);

    queryClient.setQueryData<{ videos: VideoAIData[]; total: number } | undefined>(['videoList', userId], oldData => {
      if (!oldData) return undefined;
      return {
        ...oldData,
        videos: oldData.videos.map(v => (v._id !== id ? v : data))
      };
    });
  };

  const isNewUser = (videos?.total ?? 0) <= 1;

  if (isLoading) {
    return <GlobalSpinner />;
  }

  return (
    <Container w="100%" maxW={{ base: '100%', md: '900px', lg: '1000', xl: '1200' }} pb={10}>
      <HStack justifyContent="space-between" alignItems="center" mb={8} mt={8}>
        <Heading>{isNewUser ? "Let's start creating!" : 'Projects'}</Heading>
        <HStack spacing={4}>
          {/* Add walkthrough help button for new users */}
          {isNewUser && <WalkthroughButton walkthroughType="videoList" />}

          <HStack
            spacing={1}
            bg="whiteAlpha.100"
            border="1px solid"
            borderColor="whiteAlpha.200"
            borderRadius="md"
            p={1}
          >
            <IconButton
              aria-label="Grid view"
              icon={<BsGrid />}
              size="sm"
              colorScheme={viewMode === 'grid' ? 'white' : 'whiteAlpha.200'}
              variant={viewMode === 'grid' ? 'solid' : 'ghost'}
              onClick={() => setViewMode('grid')}
            />
            <IconButton
              aria-label="List view"
              icon={<BsList />}
              size="sm"
              colorScheme={viewMode === 'list' ? 'white' : 'whiteAlpha.200'}
              variant={viewMode === 'list' ? 'solid' : 'ghost'}
              onClick={() => setViewMode('list')}
            />
          </HStack>
        </HStack>
      </HStack>

      {videos?.videos?.length ? (
        <>
          <VideoList data={videos.videos} onDelete={deleteVideo} onEdit={editVideo} viewMode={viewMode} />
          {(videos?.total ?? 0) / PAGE_SIZE > 1 && (
            <Pagination
              total={videos.total}
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              handlePageChange={page => setSearchParams({ page: page.toString() })}
            />
          )}
        </>
      ) : isLoading ? (
        <GlobalSpinner />
      ) : null}

      {isNewUser && <WelcomePopup isOpen={isOpen} onClose={onClose} />}
      {dialogContent}
    </Container>
  );
};

export const VideoListPage: FC = () => {
  return (
    <WalkthroughProvider>
      <VideoListPageContent />
    </WalkthroughProvider>
  );
};
