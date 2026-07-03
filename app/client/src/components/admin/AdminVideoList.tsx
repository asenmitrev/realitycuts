import { FC, useState } from 'react';
import {
  Box,
  Container,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Link,
  Text,
  Badge,
  VStack,
  HStack,
  Image,
  Button,
  useToast,
  Flex,
  Spacer,
  IconButton
} from '@chakra-ui/react';
import { FaCopy } from 'react-icons/fa';
import { useQuery } from 'react-query';
import { useApiService } from '../../hooks/useApiService';
import { PopulatedTranscriptionJob } from '../video-editor/VideoList';
import { Link as RouterLink } from 'react-router-dom';
import { formatDistance } from 'date-fns';

const ITEMS_PER_PAGE = 50;

// Extend the type to include createdAt
type ExtendedTranscriptionJob = PopulatedTranscriptionJob & {
  createdAt?: string;
};

export const AdminVideoList: FC = () => {
  const [page, setPage] = useState(0);
  const [revealedEmails, setRevealedEmails] = useState<Record<string, string>>({});
  const [loadingEmails, setLoadingEmails] = useState<Record<string, boolean>>({});
  const apiService = useApiService();
  const toast = useToast();

  const { isLoading, data, error } = useQuery({
    queryKey: ['adminAllVideos', page],
    queryFn: async () => {
      try {
        const result = await apiService.get<{ videos: ExtendedTranscriptionJob[]; total: number }>(
          `/api/videos/admin/all?skip=${page * ITEMS_PER_PAGE}&limit=${ITEMS_PER_PAGE}`
        );

        return result;
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 401) {
          toast({
            title: 'Access Denied',
            description: 'This page is only available in UAT environment',
            status: 'error',
            duration: 5000,
            isClosable: true
          });
        }
        throw err;
      }
    },
    retry: false
  });

  const revealEmail = async (userId: string) => {
    if (revealedEmails[userId] || loadingEmails[userId]) return;

    setLoadingEmails(prev => ({ ...prev, [userId]: true }));
    try {
      const response = await apiService.get<{ email: string }>(`/api/user/${userId}/email`);
      setRevealedEmails(prev => ({ ...prev, [userId]: response.email || 'Not found' }));
    } catch (error) {
      console.error('Error fetching email:', error);
      setRevealedEmails(prev => ({ ...prev, [userId]: 'Error fetching email' }));
    } finally {
      setLoadingEmails(prev => ({ ...prev, [userId]: false }));
    }
  };

  const revealAllEmails = async () => {
    if (!data?.videos) return;

    const usersToReveal = data.videos.filter(video => !revealedEmails[video.userId]);
    if (usersToReveal.length === 0) return;

    // Set loading state for all users
    const loadingState = usersToReveal.reduce((acc, video) => {
      acc[video.userId] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setLoadingEmails(prev => ({ ...prev, ...loadingState }));

    // Fetch all emails in parallel
    const emailPromises = usersToReveal.map(async video => {
      try {
        const response = await apiService.get<{ email: string }>(`/api/user/${video.userId}/email`);
        return { userId: video.userId, email: response.email || 'Not found' };
      } catch (error) {
        console.error(`Error fetching email for ${video.userId}:`, error);
        return { userId: video.userId, email: 'Error fetching email' };
      }
    });

    try {
      const results = await Promise.all(emailPromises);
      const emailMap = results.reduce((acc, { userId, email }) => {
        acc[userId] = email;
        return acc;
      }, {} as Record<string, string>);

      setRevealedEmails(prev => ({ ...prev, ...emailMap }));
    } finally {
      // Clear loading states
      const clearedLoadingState = usersToReveal.reduce((acc, video) => {
        acc[video.userId] = false;
        return acc;
      }, {} as Record<string, boolean>);
      setLoadingEmails(prev => ({ ...prev, ...clearedLoadingState }));
    }
  };

  const hideAllEmails = () => {
    setRevealedEmails({});
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied to clipboard',
        status: 'success',
        duration: 2000,
        isClosable: true
      });
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast({
        title: 'Failed to copy',
        status: 'error',
        duration: 2000,
        isClosable: true
      });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'green';
      case 'FAILED':
        return 'red';
      case 'TRANSCRIBED':
        return 'blue';
      case 'VIDEO_RECEIVED':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const getTruncatedUserId = (userId: string) => {
    return userId;
  };

  if (error) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4}>
          <Heading color="red.500">Access Denied</Heading>
          <Text>This page is only available in UAT environment.</Text>
        </VStack>
      </Container>
    );
  }

  const totalPages = data ? Math.ceil(data.total / ITEMS_PER_PAGE) : 0;

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        <Flex>
          <VStack align="start" spacing={2}>
            <Heading size="lg" color="red.400">
              🔒 SECRET ADMIN PAGE (UAT ONLY)
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Shows all videos across all users. Total: {data?.total || 0}
            </Text>
          </VStack>
          <Spacer />
          <HStack>
            <Button as={RouterLink} to="/admin" size="sm" colorScheme="purple" variant="solid">
              Back to Dashboard
            </Button>
            <Button
              size="sm"
              onClick={revealAllEmails}
              isDisabled={
                !data?.videos || data.videos.length === 0 || Object.keys(loadingEmails).some(k => loadingEmails[k])
              }
              colorScheme="blue"
              variant="outline"
            >
              Reveal All Emails
            </Button>
            <Button
              size="sm"
              onClick={hideAllEmails}
              isDisabled={Object.keys(revealedEmails).length === 0}
              colorScheme="gray"
              variant="outline"
            >
              Hide All Emails
            </Button>
            <Button size="sm" isDisabled={page === 0 || isLoading} onClick={() => setPage(p => Math.max(0, p - 1))}>
              Previous
            </Button>
            <Text fontSize="sm">
              Page {page + 1} of {totalPages}
            </Text>
            <Button size="sm" isDisabled={page >= totalPages - 1 || isLoading} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </HStack>
        </Flex>

        {isLoading ? (
          <Text>Loading...</Text>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Thumbnail</Th>
                  <Th>Title</Th>
                  <Th>User ID</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data?.videos.map(video => (
                  <Tr key={video._id}>
                    <Td>
                      <Image
                        src={video.thumbnailUrl}
                        alt="thumbnail"
                        boxSize="60px"
                        objectFit="cover"
                        borderRadius="md"
                        fallback={<Box boxSize="60px" bg="gray.200" borderRadius="md" />}
                      />
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="medium" noOfLines={2} maxW="200px">
                          {video.title || 'Untitled'}
                        </Text>
                        {video.videoAIData?.[0] && (
                          <Text fontSize="xs" color="gray.500">
                            ID: {video.videoAIData[0]._id}
                          </Text>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Text fontFamily="mono" fontSize="sm" title={video.userId}>
                          {getTruncatedUserId(video.userId)}
                        </Text>
                        <IconButton
                          aria-label="Copy user ID"
                          icon={<FaCopy />}
                          size="xs"
                          variant="ghost"
                          onClick={() => copyToClipboard(video.userId)}
                        />
                      </HStack>
                    </Td>
                    <Td>
                      {revealedEmails[video.userId] ? (
                        <Text fontSize="sm" color="blue.600">
                          {revealedEmails[video.userId]}
                        </Text>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => revealEmail(video.userId)}
                          isLoading={loadingEmails[video.userId]}
                          loadingText="..."
                        >
                          Reveal Email
                        </Button>
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme={getStatusBadgeColor(video.status)} size="sm">
                        {video.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {video.createdAt
                          ? formatDistance(new Date(video.createdAt), new Date(), { addSuffix: true })
                          : 'Unknown'}
                      </Text>
                    </Td>
                    <Td>
                      {video.videoAIData?.[0] ? (
                        <Link as={RouterLink} to={`/videos/${video.videoAIData[0]._id}`} color="blue.500" fontSize="sm">
                          View
                        </Link>
                      ) : (
                        <Link as={RouterLink} to={`/upload-progress/${video._id}`} color="blue.500" fontSize="sm">
                          View
                        </Link>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </VStack>
    </Container>
  );
};
