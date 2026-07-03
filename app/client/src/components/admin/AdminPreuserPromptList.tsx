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
import { useQuery } from 'react-query';
import { useApiService } from '../../hooks/useApiService';
import { formatDistance } from 'date-fns';
import { FaCopy } from 'react-icons/fa';
import { Link as RouterLink } from 'react-router-dom';

const ITEMS_PER_PAGE = 50;

interface IPreuserPrompt {
  _id: string;
  token: string;
  prompt: string;
  libraryIds?: string;
  createdAt: string;
}

export const AdminPreuserPromptList: FC = () => {
  const [page, setPage] = useState(0);
  const apiService = useApiService();
  const toast = useToast();

  const { isLoading, data, error } = useQuery({
    queryKey: ['adminAllPreuserPrompts', page],
    queryFn: async () => {
      try {
        return await apiService.get<{ prompts: IPreuserPrompt[]; total: number }>(
          `/api/preuser-prompts/admin/all?skip=${page * ITEMS_PER_PAGE}&limit=${ITEMS_PER_PAGE}`
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

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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
              🔒 SECRET ADMIN PREUSER PROMPTS PAGE (UAT ONLY)
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Shows all preuser prompts across all users. Total: {data?.total || 0}
            </Text>
            <Text fontSize="xs" color="gray.400">
              Note: Preuser prompts expire after 1 hour
            </Text>
          </VStack>
          <Spacer />
          <HStack>
            <Button as={RouterLink} to="/admin" size="sm" colorScheme="purple" variant="solid">
              Back to Dashboard
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
                  <Th>Token</Th>
                  <Th>Prompt</Th>
                  <Th>Library IDs</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data?.prompts.map(prompt => (
                  <Tr key={prompt._id}>
                    <Td>
                      <HStack spacing={2}>
                        <Tooltip label={prompt.token} placement="top">
                          <Text fontFamily="mono" fontSize="xs">
                            {prompt.token.substring(0, 8)}...
                          </Text>
                        </Tooltip>
                        <IconButton
                          aria-label="Copy token"
                          icon={<FaCopy />}
                          size="xs"
                          variant="ghost"
                          onClick={() => copyToClipboard(prompt.token)}
                        />
                      </HStack>
                    </Td>
                    <Td maxW="400px">
                      <Tooltip label={prompt.prompt} placement="top">
                        <Text fontSize="sm" noOfLines={2}>
                          {truncateText(prompt.prompt, 100)}
                        </Text>
                      </Tooltip>
                    </Td>
                    <Td>
                      {prompt.libraryIds ? (
                        <HStack spacing={2}>
                          <Badge colorScheme="green" size="sm">
                            {prompt.libraryIds.split(',').length} libraries
                          </Badge>
                          <Tooltip label={prompt.libraryIds} placement="top">
                            <IconButton
                              aria-label="Copy library IDs"
                              icon={<FaCopy />}
                              size="xs"
                              variant="ghost"
                              onClick={() => copyToClipboard(prompt.libraryIds!)}
                            />
                          </Tooltip>
                        </HStack>
                      ) : (
                        <Badge colorScheme="gray" size="sm">
                          No libraries
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {prompt.createdAt
                          ? formatDistance(new Date(prompt.createdAt), new Date(), { addSuffix: true })
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
