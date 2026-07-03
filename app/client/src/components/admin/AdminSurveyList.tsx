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
  Text,
  Badge,
  VStack,
  HStack,
  Button,
  useToast,
  Flex,
  Spacer,
  Tag,
  TagLabel,
  Wrap,
  WrapItem,
  IconButton
} from '@chakra-ui/react';
import { useQuery } from 'react-query';
import { useApiService } from '../../hooks/useApiService';
import { formatDistance } from 'date-fns';
import { FaCopy } from 'react-icons/fa';
import { Link as RouterLink } from 'react-router-dom';

const ITEMS_PER_PAGE = 50;

interface ISurvey {
  _id: string;
  userId: string;
  userType: 'solo_creator' | 'marketing_professional' | 'business_owner' | 'agency_freelancer' | 'other';
  userTypeOther?: string;
  usageTypes: ('youtube_videos' | 'business_promotion' | 'tiktok_instagram' | 'educational_videos' | 'other')[];
  usageTypesOther?: string;
  createdAt: string;
  updatedAt: string;
}

export const AdminSurveyList: FC = () => {
  const [page, setPage] = useState(0);
  const [revealedEmails, setRevealedEmails] = useState<Record<string, string>>({});
  const [loadingEmails, setLoadingEmails] = useState<Record<string, boolean>>({});
  const apiService = useApiService();
  const toast = useToast();

  const { isLoading, data, error } = useQuery({
    queryKey: ['adminAllSurveys', page],
    queryFn: async () => {
      try {
        return await apiService.get<{ surveys: ISurvey[]; total: number }>(
          `/api/survey/admin/all?skip=${page * ITEMS_PER_PAGE}&limit=${ITEMS_PER_PAGE}`
        );
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

  const getUserTypeBadgeColor = (userType: string) => {
    switch (userType) {
      case 'solo_creator':
        return 'blue';
      case 'marketing_professional':
        return 'green';
      case 'business_owner':
        return 'purple';
      case 'agency_freelancer':
        return 'orange';
      case 'other':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const formatUserType = (userType: string) => {
    switch (userType) {
      case 'solo_creator':
        return 'Solo Creator';
      case 'marketing_professional':
        return 'Marketing Professional';
      case 'business_owner':
        return 'Business Owner';
      case 'agency_freelancer':
        return 'Agency/Freelancer';
      case 'other':
        return 'Other';
      default:
        return userType;
    }
  };

  const formatUsageType = (usageType: string) => {
    switch (usageType) {
      case 'youtube_videos':
        return 'YouTube Videos';
      case 'business_promotion':
        return 'Business Promotion';
      case 'tiktok_instagram':
        return 'TikTok/Instagram';
      case 'educational_videos':
        return 'Educational Videos';
      case 'other':
        return 'Other';
      default:
        return usageType;
    }
  };

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
    if (!data) return;

    const usersToReveal = data.surveys.filter(survey => !revealedEmails[survey.userId]);
    if (usersToReveal.length === 0) return;

    // Set loading state for all users
    const loadingState = usersToReveal.reduce((acc, survey) => {
      acc[survey.userId] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setLoadingEmails(prev => ({ ...prev, ...loadingState }));

    // Fetch all emails in parallel
    const emailPromises = usersToReveal.map(async survey => {
      try {
        const response = await apiService.get<{ email: string }>(`/api/user/${survey.userId}/email`);
        return { userId: survey.userId, email: response.email || 'Not found' };
      } catch (error) {
        console.error(`Error fetching email for ${survey.userId}:`, error);
        return { userId: survey.userId, email: 'Error fetching email' };
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
      const clearedLoadingState = usersToReveal.reduce((acc, survey) => {
        acc[survey.userId] = false;
        return acc;
      }, {} as Record<string, boolean>);
      setLoadingEmails(prev => ({ ...prev, ...clearedLoadingState }));
    }
  };

  const hideAllEmails = () => {
    setRevealedEmails({});
  };

  const getTruncatedUserId = (userId: string) => {
    return userId;
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
              🔒 SECRET ADMIN SURVEY PAGE (UAT ONLY)
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Shows all survey responses across all users. Total: {data?.total || 0}
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
              isDisabled={!data || data.surveys.length === 0 || Object.keys(loadingEmails).some(k => loadingEmails[k])}
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
                  <Th>User ID</Th>
                  <Th>Email</Th>
                  <Th>User Type</Th>
                  <Th>Usage Types</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data?.surveys.map(survey => (
                  <Tr key={survey._id}>
                    <Td>
                      <HStack spacing={2}>
                        <Text fontFamily="mono" fontSize="sm" title={survey.userId}>
                          {getTruncatedUserId(survey.userId)}
                        </Text>
                        <IconButton
                          aria-label="Copy user ID"
                          icon={<FaCopy />}
                          size="xs"
                          variant="ghost"
                          onClick={() => copyToClipboard(survey.userId)}
                        />
                      </HStack>
                    </Td>
                    <Td>
                      {revealedEmails[survey.userId] ? (
                        <Text fontSize="sm" color="blue.600">
                          {revealedEmails[survey.userId]}
                        </Text>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => revealEmail(survey.userId)}
                          isLoading={loadingEmails[survey.userId]}
                          loadingText="..."
                        >
                          Reveal Email
                        </Button>
                      )}
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Badge colorScheme={getUserTypeBadgeColor(survey.userType)} size="sm">
                          {formatUserType(survey.userType)}
                        </Badge>
                        {survey.userType === 'other' && survey.userTypeOther && (
                          <Text fontSize="xs" color="gray.500" fontStyle="italic">
                            {survey.userTypeOther}
                          </Text>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Wrap spacing={1}>
                          {survey.usageTypes.map((usageType, index) => (
                            <WrapItem key={index}>
                              <Tag size="sm" colorScheme="blue">
                                <TagLabel>{formatUsageType(usageType)}</TagLabel>
                              </Tag>
                            </WrapItem>
                          ))}
                        </Wrap>
                        {survey.usageTypes.includes('other') && survey.usageTypesOther && (
                          <Text fontSize="xs" color="gray.500" fontStyle="italic">
                            Other: {survey.usageTypesOther}
                          </Text>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {survey.createdAt
                          ? formatDistance(new Date(survey.createdAt), new Date(), { addSuffix: true })
                          : 'Unknown'}
                      </Text>
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
