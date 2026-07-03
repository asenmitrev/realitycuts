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
  IconButton,
  Tooltip
} from '@chakra-ui/react';
import { FaCopy } from 'react-icons/fa';
import { useQuery } from 'react-query';
import { useApiService } from '../../hooks/useApiService';
import { Link as RouterLink } from 'react-router-dom';
import { formatDistance } from 'date-fns';
import { CaptionSettings } from '../../types';

const ITEMS_PER_PAGE = 50;

// Automation type definition
interface Automation {
  _id: string;
  userId: string;
  isEnabled: boolean;
  environment: string;
  schedule: {
    type: 'DAILY' | 'WEEKLY';
    dailyTimes?: Array<{
      hour: number;
      minute: number;
      label: string;
    }>;
    weeklyDays?: number[];
    weeklyTime?: {
      hour: number;
      minute: number;
    };
  };
  contentSettings: {
    theme: string;
    voiceId?: string;
    isVoicePremium?: boolean;
    privateLibraryIds?: string[];
    publicLibraryIds?: string[];
    allPublicLibrariesSelected?: boolean;
    pexels?: boolean;
    isPublic: boolean;
    captionPreset?: CaptionSettings;
    hashtags?: string;
    includeMusic?: boolean;
  };
  lastProcessed?: string;
  processedTimeSlots?: Record<string, string>;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
}

export const AdminAutomationList: FC = () => {
  const [page, setPage] = useState(0);
  const [revealedEmails, setRevealedEmails] = useState<Record<string, string>>({});
  const [loadingEmails, setLoadingEmails] = useState<Record<string, boolean>>({});
  const apiService = useApiService();
  const toast = useToast();

  const { isLoading, data, error } = useQuery({
    queryKey: ['adminAllAutomations', page],
    queryFn: async () => {
      try {
        return await apiService.get<{ automations: Automation[]; total: number }>(
          `/api/automation-config/admin/all?skip=${page * ITEMS_PER_PAGE}&limit=${ITEMS_PER_PAGE}`
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
    if (!data?.automations) return;

    const usersToReveal = data.automations.filter(automation => !revealedEmails[automation.userId]);
    if (usersToReveal.length === 0) return;

    // Set loading state for all users
    const loadingState = usersToReveal.reduce((acc, automation) => {
      acc[automation.userId] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setLoadingEmails(prev => ({ ...prev, ...loadingState }));

    // Fetch all emails in parallel
    const emailPromises = usersToReveal.map(async automation => {
      try {
        const response = await apiService.get<{ email: string }>(`/api/user/${automation.userId}/email`);
        return { userId: automation.userId, email: response.email || 'Not found' };
      } catch (error) {
        console.error(`Error fetching email for ${automation.userId}:`, error);
        return { userId: automation.userId, email: 'Error fetching email' };
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
      const clearedLoadingState = usersToReveal.reduce((acc, automation) => {
        acc[automation.userId] = false;
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
      case 'ACTIVE':
        return 'green';
      case 'PAUSED':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getEnabledBadgeColor = (isEnabled: boolean) => {
    return isEnabled ? 'green' : 'red';
  };

  const getScheduleDisplay = (automation: Automation) => {
    if (automation.schedule.type === 'DAILY') {
      const times = automation.schedule.dailyTimes || [];
      return `Daily (${times.length}x)`;
    } else if (automation.schedule.type === 'WEEKLY') {
      const days = automation.schedule.weeklyDays || [];
      return `Weekly (${days.length} days)`;
    }
    return 'Unknown';
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
            <Heading size="lg" color="teal.400">
              🤖 SECRET ADMIN AUTOMATIONS (UAT ONLY)
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Shows all automations across all users. Total: {data?.total || 0}
            </Text>
          </VStack>
          <Spacer />
          <HStack>
            <Button as={RouterLink} to="/admin" size="sm" colorScheme="teal" variant="solid">
              Back to Dashboard
            </Button>
            <Button
              size="sm"
              onClick={revealAllEmails}
              isDisabled={
                !data?.automations ||
                data.automations.length === 0 ||
                Object.keys(loadingEmails).some(k => loadingEmails[k])
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
                  <Th>Theme</Th>
                  <Th>User ID</Th>
                  <Th>Email</Th>
                  <Th>Schedule</Th>
                  <Th>Status</Th>
                  <Th>Enabled</Th>
                  <Th>Last Processed</Th>
                  <Th>Environment</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data?.automations.map(automation => (
                  <Tr key={automation._id}>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="medium" noOfLines={2} maxW="200px">
                          {automation.contentSettings?.theme || 'No theme'}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          ID: {automation._id}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Text fontFamily="mono" fontSize="xs" title={automation.userId} noOfLines={1} maxW="120px">
                          {automation.userId}
                        </Text>
                        <IconButton
                          aria-label="Copy user ID"
                          icon={<FaCopy />}
                          size="xs"
                          variant="ghost"
                          onClick={() => copyToClipboard(automation.userId)}
                        />
                      </HStack>
                    </Td>
                    <Td>
                      {revealedEmails[automation.userId] ? (
                        <Text fontSize="sm" color="blue.600">
                          {revealedEmails[automation.userId]}
                        </Text>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => revealEmail(automation.userId)}
                          isLoading={loadingEmails[automation.userId]}
                          loadingText="..."
                        >
                          Reveal Email
                        </Button>
                      )}
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Badge colorScheme={automation.schedule.type === 'DAILY' ? 'blue' : 'purple'} size="sm">
                          {getScheduleDisplay(automation)}
                        </Badge>
                        {automation.schedule.type === 'DAILY' && automation.schedule.dailyTimes && (
                          <Text fontSize="xs" color="gray.500">
                            {automation.schedule.dailyTimes
                              .map(
                                t => `${t.hour?.toString().padStart(2, '0')}:${t.minute?.toString().padStart(2, '0')}`
                              )
                              .join(', ')}
                          </Text>
                        )}
                        {automation.schedule.type === 'WEEKLY' && automation.schedule.weeklyTime && (
                          <Text fontSize="xs" color="gray.500">
                            {automation.schedule.weeklyTime.hour?.toString().padStart(2, '0')}:
                            {automation.schedule.weeklyTime.minute?.toString().padStart(2, '0')}
                          </Text>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      <Badge colorScheme={getStatusBadgeColor(automation.status)} size="sm">
                        {automation.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={getEnabledBadgeColor(automation.isEnabled)} size="sm">
                        {automation.isEnabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </Td>
                    <Td>
                      {automation.lastProcessed ? (
                        <Tooltip label={new Date(automation.lastProcessed).toLocaleString()}>
                          <Text fontSize="sm">
                            {formatDistance(new Date(automation.lastProcessed), new Date(), { addSuffix: true })}
                          </Text>
                        </Tooltip>
                      ) : (
                        <Text fontSize="sm" color="gray.400">
                          Never
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme={automation.environment === 'uat' ? 'yellow' : 'cyan'} size="sm">
                        {automation.environment.toUpperCase()}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {automation.createdAt
                          ? formatDistance(new Date(automation.createdAt), new Date(), { addSuffix: true })
                          : 'Unknown'}
                      </Text>
                    </Td>
                    <Td>
                      <Button as={RouterLink} to={`/automations`} size="xs" colorScheme="teal" variant="outline">
                        View
                      </Button>
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
