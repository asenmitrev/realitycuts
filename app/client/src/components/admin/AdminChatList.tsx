import { FC, useState } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  Flex,
  Spacer,
  Spinner,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid
} from '@chakra-ui/react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useApiService } from '../../hooks/useApiService';
import { FiSearch, FiMessageSquare, FiVideo, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

interface ConversationSummary {
  _id: string;
  userId: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  hasVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConversationsResponse {
  conversations: ConversationSummary[];
  total: number;
  skip: number;
  limit: number;
}

interface ChatStats {
  totalConversations: number;
  activeConversations: number;
  conversationsInPeriod: number;
  uniqueUsersInPeriod: number;
  conversationsWithVideos: number;
  periodDays: number;
}

export const AdminChatList: FC = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;
  const apiService = useApiService();
  const navigate = useNavigate();

  // Fetch conversations
  const { data, isLoading, error } = useQuery<ConversationsResponse>({
    queryKey: ['adminChats', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        skip: (page * limit).toString(),
        limit: limit.toString(),
        ...(search && { search })
      });
      return apiService.get<ConversationsResponse>(`/api/chat/admin/conversations?${params}`);
    },
    keepPreviousData: true
  });

  // Fetch stats
  const { data: stats } = useQuery<ChatStats>({
    queryKey: ['adminChatStats'],
    queryFn: async () => {
      return apiService.get<ChatStats>('/api/chat/admin/stats?days=28');
    }
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(0);
  };

  const handleViewChat = (conversationId: string) => {
    navigate(`/admin/chats/${conversationId}`);
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Flex align="center">
          <VStack align="start" spacing={1}>
            <HStack>
              <Icon as={HiSparkles} color="teal.400" boxSize={8} />
              <Heading size="xl" color="teal.400">
                Chat Analytics
              </Heading>
            </HStack>
            <Text color="gray.500">
              View all user conversations and chat activity
            </Text>
          </VStack>
          <Spacer />
        </Flex>

        {/* Stats Cards */}
        {stats && (
          <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4}>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel color="gray.500">Total Chats</StatLabel>
                  <StatNumber>{stats.totalConversations}</StatNumber>
                  <StatHelpText>All time</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel color="gray.500">Active Chats</StatLabel>
                  <StatNumber>{stats.activeConversations}</StatNumber>
                  <StatHelpText>Not deleted</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel color="gray.500">Recent Chats</StatLabel>
                  <StatNumber>{stats.conversationsInPeriod}</StatNumber>
                  <StatHelpText>Last {stats.periodDays} days</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel color="gray.500">Unique Users</StatLabel>
                  <StatNumber>{stats.uniqueUsersInPeriod}</StatNumber>
                  <StatHelpText>Last {stats.periodDays} days</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel color="gray.500">With Videos</StatLabel>
                  <StatNumber>{stats.conversationsWithVideos}</StatNumber>
                  <StatHelpText>Generated video</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </SimpleGrid>
        )}

        {/* Search and Controls */}
        <HStack>
          <InputGroup maxW="400px">
            <InputLeftElement>
              <Icon as={FiSearch} color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search by user ID or title..."
              value={search}
              onChange={handleSearch}
            />
          </InputGroup>
          <Spacer />
          <Text color="gray.500" fontSize="sm">
            {data?.total || 0} conversations found
          </Text>
        </HStack>

        {/* Conversations Table */}
        <Card>
          <CardBody p={0}>
            {isLoading ? (
              <Flex justify="center" py={12}>
                <Spinner size="xl" color="teal.400" />
              </Flex>
            ) : (
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Title</Th>
                      <Th>User ID</Th>
                      <Th isNumeric>Messages</Th>
                      <Th>Status</Th>
                      <Th>Last Activity</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data?.conversations.map((conv) => (
                      <Tr
                        key={conv._id}
                        _hover={{ bg: 'whiteAlpha.100' }}
                        cursor="pointer"
                        onClick={() => handleViewChat(conv._id)}
                      >
                        <Td>
                          <VStack align="start" spacing={0}>
                            <Text fontWeight="medium" noOfLines={1} maxW="300px">
                              {conv.title}
                            </Text>
                            <Text fontSize="xs" color="gray.500" noOfLines={1} maxW="300px">
                              {conv.lastMessage || 'No messages'}
                            </Text>
                          </VStack>
                        </Td>
                        <Td>
                          <Text fontSize="sm" fontFamily="mono" color="gray.400">
                            {conv.userId.substring(0, 12)}...
                          </Text>
                        </Td>
                        <Td isNumeric>
                          <HStack justify="flex-end">
                            <Icon as={FiMessageSquare} color="gray.400" boxSize={4} />
                            <Text>{conv.messageCount}</Text>
                          </HStack>
                        </Td>
                        <Td>
                          {conv.hasVideo ? (
                            <Badge colorScheme="green" variant="subtle">
                              <HStack spacing={1}>
                                <Icon as={FiVideo} boxSize={3} />
                                <Text>Video</Text>
                              </HStack>
                            </Badge>
                          ) : (
                            <Badge colorScheme="gray" variant="subtle">
                              Chat only
                            </Badge>
                          )}
                        </Td>
                        <Td>
                          <Text fontSize="sm" color="gray.400">
                            {formatDate(conv.updatedAt)}
                          </Text>
                        </Td>
                        <Td>
                          <Button
                            size="sm"
                            colorScheme="teal"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewChat(conv._id);
                            }}
                          >
                            View
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </CardBody>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <HStack justify="center" spacing={4}>
            <Button
              size="sm"
              leftIcon={<Icon as={FiChevronLeft} />}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              isDisabled={page === 0}
            >
              Previous
            </Button>
            <Text color="gray.500">
              Page {page + 1} of {totalPages}
            </Text>
            <Button
              size="sm"
              rightIcon={<Icon as={FiChevronRight} />}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              isDisabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </HStack>
        )}
      </VStack>
    </Container>
  );
};
