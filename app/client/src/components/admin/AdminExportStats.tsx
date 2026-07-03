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
  Input,
  FormControl,
  FormLabel,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  IconButton
} from '@chakra-ui/react';
import { FaCopy } from 'react-icons/fa';
import { useQuery } from 'react-query';
import { useApiService } from '../../hooks/useApiService';
import { Link as RouterLink } from 'react-router-dom';

interface IExportStat {
  _id: string;
  count: number;
}

export const AdminExportStats: FC = () => {
  const [days, setDays] = useState(25);
  const [revealedEmails, setRevealedEmails] = useState<Record<string, string>>({});
  const [loadingEmails, setLoadingEmails] = useState<Record<string, boolean>>({});
  const apiService = useApiService();
  const toast = useToast();

  const { isLoading, data, error, refetch } = useQuery({
    queryKey: ['adminExportStats', days],
    queryFn: async () => {
      try {
        return await apiService.get<IExportStat[]>(`/api/exports/stats/by-user?days=${days}`);
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

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDays = parseInt(e.target.value) || 1;
    setDays(Math.max(1, newDays));
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

    const usersToReveal = data.filter(stat => !revealedEmails[stat._id]);
    if (usersToReveal.length === 0) return;

    // Set loading state for all users
    const loadingState = usersToReveal.reduce((acc, stat) => {
      acc[stat._id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setLoadingEmails(prev => ({ ...prev, ...loadingState }));

    // Fetch all emails in parallel
    const emailPromises = usersToReveal.map(async stat => {
      try {
        const response = await apiService.get<{ email: string }>(`/api/user/${stat._id}/email`);
        return { userId: stat._id, email: response.email || 'Not found' };
      } catch (error) {
        console.error(`Error fetching email for ${stat._id}:`, error);
        return { userId: stat._id, email: 'Error fetching email' };
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
      const clearedLoadingState = usersToReveal.reduce((acc, stat) => {
        acc[stat._id] = false;
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

  const getCountBadgeColor = (count: number) => {
    if (count >= 10) return 'red';
    if (count >= 5) return 'orange';
    if (count >= 2) return 'yellow';
    return 'green';
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

  // Calculate summary stats
  const totalUsers = data?.length || 0;
  const totalExports = data?.reduce((sum, stat) => sum + stat.count, 0) || 0;
  const averageExports = totalUsers > 0 ? (totalExports / totalUsers).toFixed(1) : '0';
  const maxExports = data?.length ?? 0 > 0 ? Math.max(...data!.map(stat => stat.count)) : 0;

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

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        <Flex>
          <VStack align="start" spacing={2}>
            <Heading size="lg" color="red.400">
              🔒 SECRET ADMIN EXPORT STATS (UAT ONLY)
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Shows export statistics by user (excluding founders) for the last {days} days
            </Text>
          </VStack>
          <Spacer />
          <HStack>
            <Button as={RouterLink} to="/admin" size="sm" colorScheme="purple" variant="solid">
              Back to Dashboard
            </Button>
            <FormControl maxW="150px">
              <FormLabel fontSize="sm">Days</FormLabel>
              <Input type="number" value={days} onChange={handleDaysChange} min="1" size="sm" />
            </FormControl>
            <Button size="sm" onClick={() => refetch()} isLoading={isLoading}>
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={revealAllEmails}
              isDisabled={!data || data.length === 0 || Object.keys(loadingEmails).some(k => loadingEmails[k])}
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
          </HStack>
        </Flex>

        {/* Summary Statistics */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Active Users</StatLabel>
                <StatNumber>{totalUsers}</StatNumber>
                <StatHelpText>Users with exports</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Exports</StatLabel>
                <StatNumber>{totalExports}</StatNumber>
                <StatHelpText>Last {days} days</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Average per User</StatLabel>
                <StatNumber>{averageExports}</StatNumber>
                <StatHelpText>Exports per user</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Highest User</StatLabel>
                <StatNumber>{maxExports}</StatNumber>
                <StatHelpText>Max exports</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {isLoading ? (
          <Text>Loading...</Text>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Rank</Th>
                  <Th>User ID</Th>
                  <Th>Email</Th>
                  <Th>Export Count</Th>
                  <Th>Activity Level</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data?.map((stat, index) => (
                  <Tr key={stat._id}>
                    <Td>
                      <Badge colorScheme={index < 3 ? 'purple' : 'gray'} size="sm">
                        #{index + 1}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Text fontFamily="mono" fontSize="sm" title={stat._id}>
                          {getTruncatedUserId(stat._id)}
                        </Text>
                        <IconButton
                          aria-label="Copy user ID"
                          icon={<FaCopy />}
                          size="xs"
                          variant="ghost"
                          onClick={() => copyToClipboard(stat._id)}
                        />
                      </HStack>
                    </Td>
                    <Td>
                      {revealedEmails[stat._id] ? (
                        <Text fontSize="sm" color="blue.600">
                          {revealedEmails[stat._id]}
                        </Text>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => revealEmail(stat._id)}
                          isLoading={loadingEmails[stat._id]}
                          loadingText="..."
                        >
                          Reveal Email
                        </Button>
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme={getCountBadgeColor(stat.count)} size="lg">
                        {stat.count}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="gray.600">
                        {stat.count >= 10
                          ? 'Very Active'
                          : stat.count >= 5
                          ? 'Active'
                          : stat.count >= 2
                          ? 'Moderate'
                          : 'Light'}
                      </Text>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            {data && data.length === 0 && (
              <VStack py={8} spacing={4}>
                <Text color="gray.500">No export data found for the last {days} days</Text>
              </VStack>
            )}
          </Box>
        )}
      </VStack>
    </Container>
  );
};
