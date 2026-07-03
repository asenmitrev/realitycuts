import {
  Box,
  Text,
  Spinner,
  Center,
  Container,
  Heading,
  Flex,
  Button,
  useToast,
  Badge,
  VStack,
  HStack,
  Divider
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { LibraryItem } from './LibraryItem';
import { Pagination } from '../common/Pagination';
import { useLibraryData } from '../../hooks/useLibraryData';
import { useProfile } from '../../contexts/profile/hooks';
import { useLibraryOperations } from '../../hooks/useLibraryOperations';
import { useApiService } from '../../hooks/useApiService';
import { useConfirmDialogV2 } from '../../hooks/useConfirmDialog';
import { IBrollFootageMetadata } from '../../types';
import { useQuery } from 'react-query';

const DUPLICATES_PER_PAGE = 50;

interface DuplicateGroup {
  hash: string;
  items: IBrollFootageMetadata[];
  count: number;
}

interface DuplicatesResponse {
  duplicates: DuplicateGroup[];
  totalDuplicateGroups: number;
  totalDuplicates: number;
  totalItems: number;
  skip: number;
  limit: number;
}

export const LibraryDuplicateDetection = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const userProfile = useProfile();
  const toast = useToast();
  const apiService = useApiService();

  // Selection state for batch deletion
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Check if user is admin
  const isAdmin = userProfile?.isAdmin ?? false;

  // Fetch library data
  const { library, isLoadingLibrary } = useLibraryData(id, 0);

  // Fetch duplicates grouped by hash with pagination
  const {
    data: duplicatesData,
    isLoading: isLoadingDuplicates,
    refetch: refetchDuplicates
  } = useQuery<DuplicatesResponse>({
    queryKey: ['library', id, 'duplicates', currentPage],
    queryFn: async () => {
      const skip = currentPage * DUPLICATES_PER_PAGE;
      const response = await apiService.get<DuplicatesResponse>(
        `/api/library/${id}/duplicates?skip=${skip}&limit=${DUPLICATES_PER_PAGE}`
      );
      return response;
    },
    enabled: !!id
  });

  const duplicates = duplicatesData?.duplicates ?? [];

  // Wrapper function for refetching duplicates
  const handleRefetchDuplicates = useCallback(async () => {
    const result = await refetchDuplicates();
    // If current page becomes empty after deletion, go back a page
    if (result.data?.duplicates && result.data.duplicates.length === 0 && currentPage > 0) {
      setCurrentPage(prev => Math.max(0, prev - 1));
    }
  }, [refetchDuplicates, currentPage]);

  // Get delete operations - use our wrapper function
  const { deleteBroll } = useLibraryOperations(id, handleRefetchDuplicates);

  // Bulk delete confirmation dialog
  const { dialogContent: bulkDeleteDialog, awaitConfirmation: awaitBulkDeleteConfirmation } = useConfirmDialogV2({
    title: `Delete ${selectedItems.size} Duplicate Video${selectedItems.size !== 1 ? 's' : ''}`,
    type: 'delete'
  });

  // Clear all selections
  const handleClearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  // Batch delete selected items
  const handleBatchDelete = useCallback(async () => {
    if (!id) return;

    if (selectedItems.size === 0) {
      toast({
        title: 'No items selected',
        description: 'Please select items to delete',
        status: 'warning',
        duration: 3000,
        isClosable: true
      });
      return;
    }

    setIsDeleting(true);

    try {
      // Show confirmation dialog
      await awaitBulkDeleteConfirmation();

      // Use bulk delete API endpoint
      await apiService.post<{ message: string }, { brollIds: string[] }>(`/api/library/${id}/broll/bulk-delete`, {
        brollIds: Array.from(selectedItems)
      });

      toast({
        title: 'Success',
        description: `Deleted ${selectedItems.size} duplicate(s)`,
        status: 'success',
        duration: 3000,
        isClosable: true
      });

      // Clear selections
      handleClearSelection();

      // Refetch duplicates after deletion
      await handleRefetchDuplicates();
    } catch (error) {
      // Don't show error toast if user cancelled
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to delete duplicates',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setIsDeleting(false);
    }
  }, [
    id,
    selectedItems,
    apiService,
    toast,
    awaitBulkDeleteConfirmation,
    handleClearSelection,
    handleRefetchDuplicates
  ]);

  const handleDeleteBroll = useCallback(
    async (itemId: string) => {
      // deleteBroll already calls handleRefetchDuplicates internally
      await deleteBroll(itemId);
    },
    [deleteBroll]
  );

  // Select all items in a group
  const handleSelectGroup = (group: DuplicateGroup) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      // Select all items except the first one (keep one original)
      group.items.slice(1).forEach(item => {
        if (item._id) {
          newSet.add(item._id);
        }
      });
      return newSet;
    });
  };

  // Select all duplicates (keeping one from each group)
  const handleSelectAll = useCallback(() => {
    if (!duplicatesData) return;
    const allDuplicateIds = new Set<string>();
    duplicatesData.duplicates.forEach(group => {
      // Select all items except the first one (keep one original)
      group.items.slice(1).forEach(item => {
        if (item._id) {
          allDuplicateIds.add(item._id);
        }
      });
    });
    setSelectedItems(allDuplicateIds);
  }, [duplicatesData]);

  const totalDuplicateGroups = duplicatesData?.totalDuplicateGroups ?? 0;
  const totalItems = duplicatesData?.totalItems ?? 0;

  // Redirect if not admin
  if (!isAdmin) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center h="200px">
          <Text>Access denied. Admin only.</Text>
        </Center>
      </Container>
    );
  }

  if (isLoadingLibrary || isLoadingDuplicates) {
    return (
      <Center h="200px">
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <>
      {bulkDeleteDialog}
      <Container
        w="100%"
        maxW={{ base: '100%', md: '1400px', lg: '1600px', xl: '1800px' }}
        pb={10}
        px={{ base: 4, md: 6 }}
      >
        <Flex justifyContent="space-between" alignItems="center" mb={6}>
          <Heading py={10} display="flex" gap={4} alignItems="center">
            <Flex alignItems="flex-end" gap={4}>
              {library?.title ?? 'Library'} - Duplicate Detection
            </Flex>
          </Heading>
          <Button onClick={() => navigate(`/libraries/${id}`)} variant="outline">
            Back to Library
          </Button>
        </Flex>

        {duplicates.length > 0 ? (
          <>
            <Box mb={6} p={4} borderRadius="md" borderWidth="1px" borderColor="blue.200">
              <VStack align="stretch" spacing={2}>
                <HStack justifyContent="space-between">
                  <Text fontWeight="bold" fontSize="lg">
                    Found {totalDuplicateGroups} duplicate group{totalDuplicateGroups !== 1 ? 's' : ''}
                  </Text>
                  <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
                    {totalItems} total items
                  </Badge>
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  Items are grouped by perceptual hash. You can delete duplicates while keeping one original from each
                  group.
                </Text>
              </VStack>
            </Box>

            <Pagination
              total={totalDuplicateGroups}
              currentPage={currentPage}
              pageSize={DUPLICATES_PER_PAGE}
              handlePageChange={setCurrentPage}
            />

            <Flex gap={2} mb={6} flexWrap="wrap">
              <Button size="sm" onClick={handleSelectAll} isDisabled={duplicates.length === 0}>
                Select All Duplicates
              </Button>
              <Button size="sm" onClick={handleClearSelection} isDisabled={selectedItems.size === 0}>
                Clear ({selectedItems.size})
              </Button>
              <Button
                size="sm"
                colorScheme="red"
                onClick={handleBatchDelete}
                isDisabled={selectedItems.size === 0 || isDeleting}
                isLoading={isDeleting}
              >
                Delete Selected
              </Button>
            </Flex>

            <VStack spacing={8} align="stretch">
              {duplicates.map(group => {
                // Keep first item, mark others as duplicates
                const duplicateItems = group.items.slice(1);

                return (
                  <Box key={group.hash} borderWidth="1px" borderRadius="lg" p={6}>
                    <VStack align="stretch" spacing={4}>
                      <HStack justifyContent="space-between" alignItems="center">
                        <HStack>
                          <Badge colorScheme="red" fontSize="md" px={3} py={1}>
                            {group.count} duplicate{group.count !== 1 ? 's' : ''}
                          </Badge>
                          <Text fontSize="sm" color="gray.600" fontFamily="mono">
                            Hash: {group.hash.substring(0, 16)}...
                          </Text>
                        </HStack>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectGroup(group)}
                          isDisabled={duplicateItems.length === 0}
                        >
                          Select All in Group ({duplicateItems.length})
                        </Button>
                      </HStack>

                      <Divider />

                      <Box>
                        <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.600">
                          All duplicates in this group ({group.items.length}):
                        </Text>
                        <Box
                          overflowX="auto"
                          overflowY="hidden"
                          css={{
                            '&::-webkit-scrollbar': {
                              height: '8px'
                            },
                            '&::-webkit-scrollbar-track': {
                              background: 'transparent'
                            },
                            '&::-webkit-scrollbar-thumb': {
                              background: '#cbd5e0',
                              borderRadius: '4px'
                            },
                            '&::-webkit-scrollbar-thumb:hover': {
                              background: '#a0aec0'
                            }
                          }}
                        >
                          <Flex gap={2} minW="min-content" pb={2}>
                            {group.items.map((item, index) => {
                              const itemId = item._id ?? '';
                              const isOriginal = index === 0;
                              return (
                                <Box
                                  key={itemId}
                                  minW="150px"
                                  maxW="150px"
                                  flexShrink={0}
                                  position="relative"
                                  borderWidth={isOriginal ? '2px' : '1px'}
                                  borderColor={isOriginal ? 'green.500' : 'transparent'}
                                  borderRadius="md"
                                  p={isOriginal ? 1 : 0}
                                  overflow="hidden"
                                >
                                  {isOriginal && (
                                    <Badge
                                      position="absolute"
                                      top={2}
                                      right={2}
                                      zIndex={10}
                                      colorScheme="green"
                                      fontSize="xs"
                                    >
                                      Original
                                    </Badge>
                                  )}
                                  <LibraryItem
                                    item={item}
                                    videoUrl={item.preview ? item.preview : item.url}
                                    isOwner={true}
                                    deleteId={itemId}
                                    onDelete={handleDeleteBroll}
                                    isSelected={!isOriginal && selectedItems.has(itemId)}
                                    onSelectionChange={(id, selected) => {
                                      if (isOriginal) return; // Don't allow selecting the original
                                      if (selected) {
                                        setSelectedItems(prev => new Set(prev).add(id));
                                      } else {
                                        setSelectedItems(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(id);
                                          return newSet;
                                        });
                                      }
                                    }}
                                    isAdmin={isAdmin}
                                  />
                                </Box>
                              );
                            })}
                          </Flex>
                        </Box>
                      </Box>
                    </VStack>
                  </Box>
                );
              })}
            </VStack>
          </>
        ) : (
          <Center h="400px">
            <VStack spacing={4}>
              <Text fontSize="xl" fontWeight="bold">
                No duplicates found
              </Text>
              <Text color="gray.600">
                All items in this library have unique perceptual hashes. No duplicates detected.
              </Text>
              <Button onClick={() => navigate(`/libraries/${id}`)} variant="outline">
                Back to Library
              </Button>
            </VStack>
          </Center>
        )}
      </Container>
    </>
  );
};
