import {
  Box,
  Text,
  Spinner,
  Center,
  Container,
  Heading,
  Flex,
  Grid,
  GridItem,
  Divider,
  Button,
  useToast
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { LibraryItem } from './LibraryItem';
import { Pagination } from '../common/Pagination';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { BROLL_PER_PAGE } from '../../hooks/useBrollByHeuristic';
import { useBrollArollCombined } from '../../hooks/useBrollArollCombined';
import { useBrollBrollCombined } from '../../hooks/useBrollBrollCombined';
import { useBrollUnknown } from '../../hooks/useBrollUnknown';
import { useLibraryData } from '../../hooks/useLibraryData';
import { useProfile } from '../../contexts/profile/hooks';
import { useLibraryOperations } from '../../hooks/useLibraryOperations';
import { useApiService } from '../../hooks/useApiService';
import { useConfirmDialogV2 } from '../../hooks/useConfirmDialog';

export const LibraryHeuristicComparison = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const userProfile = useProfile();
  const toast = useToast();
  const [arollPage, setArollPage] = useState(0);
  const [brollPage, setBrollPage] = useState(0);
  const [unknownPage, setUnknownPage] = useState(0);

  // Selection state for batch deletion
  const [selectedAroll, setSelectedAroll] = useState<Set<string>>(new Set());
  const [selectedBroll, setSelectedBroll] = useState<Set<string>>(new Set());
  const [selectedUnknown, setSelectedUnknown] = useState<Set<string>>(new Set());
  const [isDeletingAroll, setIsDeletingAroll] = useState(false);
  const [isDeletingBroll, setIsDeletingBroll] = useState(false);
  const [isDeletingUnknown, setIsDeletingUnknown] = useState(false);

  const apiService = useApiService();

  // Check if user is admin
  const isAdmin = userProfile?.isAdmin ?? false;

  // Fetch library data
  const { library, isLoadingLibrary } = useLibraryData(id, 0);

  // Fetch A-roll items (combined from LLM, heuristic, and background motion)
  const {
    brollItems: arollItems,
    totalBroll: totalAroll,
    isLoadingBroll: isLoadingAroll,
    refetchBroll: refetchAroll
  } = useBrollArollCombined(id, arollPage);

  // Fetch B-roll items (combined from LLM, heuristic, and background motion)
  const {
    brollItems: brollItems,
    totalBroll: totalBroll,
    isLoadingBroll: isLoadingBroll,
    refetchBroll: refetchBroll
  } = useBrollBrollCombined(id, brollPage);

  // Fetch Unknown items (doesn't match A-roll or B-roll combined criteria)
  const {
    brollItems: unknownItems,
    totalBroll: totalUnknown,
    isLoadingBroll: isLoadingUnknown,
    refetchBroll: refetchUnknown
  } = useBrollUnknown(id, unknownPage);

  // Get delete operations for single item deletion
  const { deleteBroll } = useLibraryOperations(id, refetchBroll);

  // Bulk delete confirmation dialogs
  const { dialogContent: bulkDeleteArollDialog, awaitConfirmation: awaitBulkDeleteArollConfirmation } =
    useConfirmDialogV2({
      title: `Delete ${selectedAroll.size} A-roll Video${selectedAroll.size !== 1 ? 's' : ''}`,
      type: 'delete'
    });

  const { dialogContent: bulkDeleteBrollDialog, awaitConfirmation: awaitBulkDeleteBrollConfirmation } =
    useConfirmDialogV2({
      title: `Delete ${selectedBroll.size} B-roll Video${selectedBroll.size !== 1 ? 's' : ''}`,
      type: 'delete'
    });

  const { dialogContent: bulkDeleteUnknownDialog, awaitConfirmation: awaitBulkDeleteUnknownConfirmation } =
    useConfirmDialogV2({
      title: `Delete ${selectedUnknown.size} Unknown Video${selectedUnknown.size !== 1 ? 's' : ''}`,
      type: 'delete'
    });

  // Clear all selections in a category
  const handleClearSelection = useCallback((category: 'aroll' | 'broll' | 'unknown') => {
    if (category === 'aroll') {
      setSelectedAroll(new Set());
    } else if (category === 'broll') {
      setSelectedBroll(new Set());
    } else {
      setSelectedUnknown(new Set());
    }
  }, []);

  // Batch delete selected items using bulk delete API
  const handleBatchDelete = useCallback(
    async (category: 'aroll' | 'broll' | 'unknown') => {
      if (!id) return;

      const selectedIds = category === 'aroll' ? selectedAroll : category === 'broll' ? selectedBroll : selectedUnknown;

      if (selectedIds.size === 0) {
        toast({
          title: 'No items selected',
          description: 'Please select items to delete',
          status: 'warning',
          duration: 3000,
          isClosable: true
        });
        return;
      }

      // Set loading state based on category
      if (category === 'aroll') {
        setIsDeletingAroll(true);
      } else if (category === 'broll') {
        setIsDeletingBroll(true);
      } else {
        setIsDeletingUnknown(true);
      }

      try {
        // Show confirmation dialog
        if (category === 'aroll') {
          await awaitBulkDeleteArollConfirmation();
        } else if (category === 'broll') {
          await awaitBulkDeleteBrollConfirmation();
        } else {
          await awaitBulkDeleteUnknownConfirmation();
        }

        // Use bulk delete API endpoint instead of individual calls
        await apiService.post<{ message: string }, { brollIds: string[] }>(`/api/library/${id}/broll/bulk-delete`, {
          brollIds: Array.from(selectedIds)
        });

        toast({
          title: 'Success',
          description: `Deleted ${selectedIds.size} item(s)`,
          status: 'success',
          duration: 3000,
          isClosable: true
        });

        // Clear selections
        handleClearSelection(category);

        // Refetch all lists after deletion
        refetchAroll();
        refetchBroll();
        refetchUnknown();
      } catch (error) {
        // Don't show error toast if user cancelled
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
          return;
        }
        toast({
          title: 'Error',
          description: 'Failed to delete items',
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      } finally {
        // Reset loading state based on category
        if (category === 'aroll') {
          setIsDeletingAroll(false);
        } else if (category === 'broll') {
          setIsDeletingBroll(false);
        } else {
          setIsDeletingUnknown(false);
        }
      }
    },
    [
      id,
      selectedAroll,
      selectedBroll,
      selectedUnknown,
      apiService,
      toast,
      awaitBulkDeleteArollConfirmation,
      awaitBulkDeleteBrollConfirmation,
      awaitBulkDeleteUnknownConfirmation,
      handleClearSelection,
      refetchAroll,
      refetchBroll,
      refetchUnknown
    ]
  );

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

  if (isLoadingLibrary) {
    return (
      <Center h="200px">
        <Spinner size="xl" />
      </Center>
    );
  }

  const handleDeleteBroll = async (itemId: string) => {
    await deleteBroll(itemId);
    // Refetch all lists after deletion
    refetchAroll();
    refetchBroll();
    refetchUnknown();
  };

  // Toggle selection for individual items
  const handleToggleSelection = (itemId: string, category: 'aroll' | 'broll' | 'unknown') => {
    if (category === 'aroll') {
      setSelectedAroll(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else if (category === 'broll') {
      setSelectedBroll(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else {
      setSelectedUnknown(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    }
  };

  // Select all items in a category
  const handleSelectAll = (category: 'aroll' | 'broll' | 'unknown') => {
    if (category === 'aroll') {
      setSelectedAroll(new Set(arollItems.map(item => item._id ?? '')));
    } else if (category === 'broll') {
      setSelectedBroll(new Set(brollItems.map(item => item._id ?? '')));
    } else {
      setSelectedUnknown(new Set(unknownItems.map(item => item._id ?? '')));
    }
  };

  return (
    <>
      {bulkDeleteArollDialog}
      {bulkDeleteBrollDialog}
      {bulkDeleteUnknownDialog}
      <Container
        w="100%"
        maxW={{ base: '100%', md: '1400px', lg: '1600px', xl: '1800px' }}
        pb={10}
        px={{ base: 4, md: 6 }}
        overflowX="hidden"
      >
        <Flex justifyContent="space-between" alignItems="center" mb={6}>
          <Heading py={10} display="flex" gap={4} alignItems="center">
            <Flex alignItems="flex-end" gap={4}>
              {library?.title ?? 'Library'}
            </Flex>
          </Heading>
          <Button onClick={() => navigate(`/libraries/${id}`)} variant="outline">
            Back to Library
          </Button>
        </Flex>

        <Grid templateColumns={{ base: '1fr', lg: '1fr 1px 1fr 1px 1fr' }} gap={6} w="100%" minW={0}>
          {/* A-roll Column */}
          <GridItem minW={0} overflow="hidden">
            <Box w="100%" minW={0} overflow="hidden">
              <Heading size="md" mb={4} color="blue.500">
                A-roll - {totalAroll} total
              </Heading>
              <Flex gap={2} mb={4} flexWrap="wrap">
                <Button size="sm" onClick={() => handleSelectAll('aroll')} isDisabled={arollItems.length === 0}>
                  Select All
                </Button>
                <Button size="sm" onClick={() => handleClearSelection('aroll')} isDisabled={selectedAroll.size === 0}>
                  Clear ({selectedAroll.size})
                </Button>
                <Button
                  size="sm"
                  colorScheme="red"
                  onClick={() => handleBatchDelete('aroll')}
                  isDisabled={selectedAroll.size === 0 || isDeletingAroll}
                  isLoading={isDeletingAroll}
                >
                  Delete Selected
                </Button>
              </Flex>
              <Pagination
                total={totalAroll}
                currentPage={arollPage}
                pageSize={BROLL_PER_PAGE}
                handlePageChange={setArollPage}
              />
              {isLoadingAroll ? (
                <GlobalSpinner />
              ) : arollItems.length > 0 ? (
                <Box
                  w="100%"
                  minW={0}
                  overflow="hidden"
                  sx={{
                    columnCount: { base: 1, md: 2 },
                    columnGap: '16px',
                    '& > div': {
                      breakInside: 'avoid',
                      marginBottom: '16px'
                    }
                  }}
                >
                  {arollItems.map(item => {
                    const itemId = item._id ?? '';
                    return (
                      <LibraryItem
                        key={itemId}
                        item={item}
                        videoUrl={item.preview ? item.preview : item.url}
                        isOwner={true}
                        deleteId={itemId}
                        onDelete={handleDeleteBroll}
                        isSelected={selectedAroll.has(itemId)}
                        onSelectionChange={() => handleToggleSelection(itemId, 'aroll')}
                        isAdmin={isAdmin}
                      />
                    );
                  })}
                </Box>
              ) : (
                <Center h="200px">
                  <Text>No A-roll items found.</Text>
                </Center>
              )}
            </Box>
          </GridItem>

          {/* Divider */}
          <GridItem>
            <Divider orientation="vertical" height="100%" />
          </GridItem>

          {/* B-roll Column */}
          <GridItem minW={0} overflow="hidden">
            <Box w="100%" minW={0} overflow="hidden">
              <Heading size="md" mb={4} color="green.500">
                B-roll - {totalBroll} total
              </Heading>
              <Flex gap={2} mb={4} flexWrap="wrap">
                <Button size="sm" onClick={() => handleSelectAll('broll')} isDisabled={brollItems.length === 0}>
                  Select All
                </Button>
                <Button size="sm" onClick={() => handleClearSelection('broll')} isDisabled={selectedBroll.size === 0}>
                  Clear ({selectedBroll.size})
                </Button>
                <Button
                  size="sm"
                  colorScheme="red"
                  onClick={() => handleBatchDelete('broll')}
                  isDisabled={selectedBroll.size === 0 || isDeletingBroll}
                  isLoading={isDeletingBroll}
                >
                  Delete Selected
                </Button>
              </Flex>
              <Pagination
                total={totalBroll}
                currentPage={brollPage}
                pageSize={BROLL_PER_PAGE}
                handlePageChange={setBrollPage}
              />
              {isLoadingBroll ? (
                <GlobalSpinner />
              ) : brollItems.length > 0 ? (
                <Box
                  w="100%"
                  minW={0}
                  overflow="hidden"
                  sx={{
                    columnCount: { base: 1, md: 2 },
                    columnGap: '16px',
                    '& > div': {
                      breakInside: 'avoid',
                      marginBottom: '16px'
                    }
                  }}
                >
                  {brollItems.map(item => {
                    const itemId = item._id ?? '';
                    return (
                      <LibraryItem
                        key={itemId}
                        item={item}
                        videoUrl={item.preview ? item.preview : item.url}
                        isOwner={true}
                        deleteId={itemId}
                        onDelete={handleDeleteBroll}
                        isSelected={selectedBroll.has(itemId)}
                        onSelectionChange={() => handleToggleSelection(itemId, 'broll')}
                        isAdmin={isAdmin}
                      />
                    );
                  })}
                </Box>
              ) : (
                <Center h="200px">
                  <Text>No B-roll items found.</Text>
                </Center>
              )}
            </Box>
          </GridItem>

          {/* Divider */}
          <GridItem>
            <Divider orientation="vertical" height="100%" />
          </GridItem>

          {/* Unknown Column */}
          <GridItem minW={0} overflow="hidden">
            <Box w="100%" minW={0} overflow="hidden">
              <Heading size="md" mb={4} color="orange.500">
                Unknown - {totalUnknown} total
              </Heading>
              <Flex gap={2} mb={4} flexWrap="wrap">
                <Button size="sm" onClick={() => handleSelectAll('unknown')} isDisabled={unknownItems.length === 0}>
                  Select All
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleClearSelection('unknown')}
                  isDisabled={selectedUnknown.size === 0}
                >
                  Clear ({selectedUnknown.size})
                </Button>
                <Button
                  size="sm"
                  colorScheme="red"
                  onClick={() => handleBatchDelete('unknown')}
                  isDisabled={selectedUnknown.size === 0 || isDeletingUnknown}
                  isLoading={isDeletingUnknown}
                >
                  Delete Selected
                </Button>
              </Flex>
              <Pagination
                total={totalUnknown}
                currentPage={unknownPage}
                pageSize={BROLL_PER_PAGE}
                handlePageChange={setUnknownPage}
              />
              {isLoadingUnknown ? (
                <GlobalSpinner />
              ) : unknownItems.length > 0 ? (
                <Box
                  w="100%"
                  minW={0}
                  overflow="hidden"
                  sx={{
                    columnCount: { base: 1, md: 2 },
                    columnGap: '16px',
                    '& > div': {
                      breakInside: 'avoid',
                      marginBottom: '16px'
                    }
                  }}
                >
                  {unknownItems.map(item => {
                    const itemId = item._id ?? '';
                    return (
                      <LibraryItem
                        key={itemId}
                        item={item}
                        videoUrl={item.preview ? item.preview : item.url}
                        isOwner={true}
                        deleteId={itemId}
                        onDelete={handleDeleteBroll}
                        isSelected={selectedUnknown.has(itemId)}
                        onSelectionChange={() => handleToggleSelection(itemId, 'unknown')}
                        isAdmin={isAdmin}
                      />
                    );
                  })}
                </Box>
              ) : (
                <Center h="200px">
                  <Text>No unknown items found.</Text>
                </Center>
              )}
            </Box>
          </GridItem>
        </Grid>
      </Container>
    </>
  );
};
