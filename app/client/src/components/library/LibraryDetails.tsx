import {
  Box,
  Text,
  Spinner,
  Center,
  Button,
  Flex,
  Heading,
  Container,
  IconButton,
  Badge,
  Input,
  InputGroup,
  InputRightElement,
  Stack
} from '@chakra-ui/react';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { FaSearch, FaTrash, FaFilter } from 'react-icons/fa';
import { VideoAlternative } from '../../types';
import { LibraryDetailsAccordion } from './LibraryDetailsAccordion';
import { LibraryItem } from './LibraryItem';
import { LibraryFilters } from './LibraryFilters';
import { Pagination } from '../common/Pagination';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { calculateTotalProgress } from 'shared/utils/misc';
import { useUserId } from '../../contexts/firebase/hooks';
import { useProfile } from '../../contexts/profile/hooks';
import { useLibraryData, BROLL_PER_PAGE } from '../../hooks/useLibraryData';
import { useLibraryOperations } from '../../hooks/useLibraryOperations';
import { useBulkSelection } from '../../hooks/useBulkSelection';

interface MetadataFilters {
  framing: string;
  cameraAngle: string;
  perspective: string;
  depthOfField: string;
  complexity: string;
  arollBroll: string;
  focusPosition: string;
  clusterId: string;
}

const initialFilters: MetadataFilters = {
  framing: '',
  cameraAngle: '',
  perspective: '',
  depthOfField: '',
  complexity: '',
  arollBroll: '',
  focusPosition: '',
  clusterId: ''
};
export const LibraryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = useUserId();
  const userProfile = useProfile();
  const [currentPage, setCurrentPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [metadataFilters, setMetadataFilters] = useState<MetadataFilters>(initialFilters);

  // Custom hooks for data and operations
  const {
    library,
    youtubeLinks,
    brollItems,
    totalBroll,
    isLoadingLibrary,
    isLoadingBroll,
    refetchBroll
  } = useLibraryData(id, currentPage);

  const {
    isDeleting,
    isLoadingSearch,
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    youtubeLinkDeletionStatus,
    deleteLibrary,
    deleteBroll,
    handleSearch,
    deleteByYoutubeLink,
    findSimilarVideos,
    triggerClustering,
    isClustering,
    deleteLibraryDialog,
    deleteBrollDialog
  } = useLibraryOperations(id, refetchBroll);

  const { selectedItems, isBulkDeleting, handleSelectionChange, handleBulkDelete, bulkDeleteDialog } = useBulkSelection(
    id,
    refetchBroll,
    setSearchResults
  );

  // Computed values
  const isOwner = useMemo(() => {
    return library?.userId === userId || !!userProfile?.isAdmin;
  }, [library?.userId, userId, userProfile]);

  const showSearchResults = searchResults.length > 0;
  const visibleItems = useMemo(() => {
    return showSearchResults ? searchResults : brollItems;
  }, [showSearchResults, searchResults, brollItems]);

  const hasBrollItems = brollItems.length > 0;

  if (isLoadingLibrary || isLoadingSearch) {
    return (
      <Center h="200px">
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <>
      {deleteLibraryDialog}
      {isOwner && deleteBrollDialog}
      {isOwner && bulkDeleteDialog}
      <Container w="100%" maxW={{ base: '100%', md: '900px', lg: '1000', xl: '1200' }} pb={10}>
        <Heading py={10} display="flex" gap={4} alignItems="center" justifyContent="space-between" flexWrap="nowrap">
          <Flex alignItems="flex-end" gap={4}>
            {library?.title || 'Untitled Library'}
            {library?.status === 'PROCESSING' && (
              <Badge colorScheme="blue" mb={3}>
                Processing
              </Badge>
            )}
          </Flex>
          <Flex gap={4}>
            {isOwner && (
              <>
                {/* Bulk Actions Toolbar */}
                {hasBrollItems && isOwner && selectedItems.size > 0 && (
                  <Button
                    variant="outline"
                    colorScheme="red"
                    onClick={handleBulkDelete}
                    isLoading={isBulkDeleting}
                    leftIcon={<FaTrash />}
                  >
                    Delete Selected ({selectedItems.size})
                  </Button>
                )}
                <IconButton
                  isLoading={isDeleting}
                  colorScheme="red"
                  aria-label="delete library button"
                  variant="outline"
                  icon={<FaTrash />}
                  onClick={deleteLibrary}
                />
                <Button
                  colorScheme="white"
                  onClick={() => navigate(`/libraries/${id}/add`)}
                  isDisabled={library?.status === 'PROCESSING'}
                >
                  + Add to Library
                </Button>
                <Button
                  variant="outline"
                  colorScheme="purple"
                  onClick={triggerClustering}
                  isLoading={isClustering}
                  isDisabled={library?.status !== 'PROCESSED'}
                >
                  Cluster Now
                </Button>
              </>
            )}
            {userProfile?.isAdmin && (
              <>
                <Button colorScheme="blue" variant="outline" onClick={() => navigate(`/libraries/${id}/heuristic`)}>
                  A-roll/B-roll view
                </Button>
                <Button colorScheme="orange" variant="outline" onClick={() => navigate(`/libraries/${id}/duplicates`)}>
                  Find Duplicates
                </Button>
              </>
            )}
          </Flex>
        </Heading>

        <Box mb={8}>
          <Stack spacing={4}>
            <Flex gap={2}>
              <InputGroup flex={1}>
                <Input
                  placeholder="Search"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(metadataFilters)}
                />
                <InputRightElement>
                  <IconButton
                    aria-label="search"
                    variant="ghost"
                    icon={<FaSearch />}
                    onClick={() => handleSearch(metadataFilters)}
                  />
                </InputRightElement>
              </InputGroup>
              <IconButton
                aria-label="toggle filters"
                variant="outline"
                icon={<FaFilter />}
                onClick={() => setShowFilters(!showFilters)}
                colorScheme={showFilters ? 'blue' : 'gray'}
              />
            </Flex>
            {showFilters && (
              <LibraryFilters filters={metadataFilters} onFilterChange={setMetadataFilters} library={library} />
            )}
          </Stack>
        </Box>
        {library && isOwner && (
          <LibraryDetailsAccordion
            libraryStatus={library.status}
            youtubeLinks={youtubeLinks}
            processedFiles={library.processedFiles ?? []}
            handleDeleteYoutubeLink={deleteByYoutubeLink}
            youtubeLinkDeletionStatus={youtubeLinkDeletionStatus}
            progress={calculateTotalProgress(library)}
          />
        )}

        {!showSearchResults && (
          <Pagination
            total={totalBroll}
            currentPage={currentPage}
            pageSize={BROLL_PER_PAGE}
            handlePageChange={setCurrentPage}
          />
        )}
        {hasBrollItems ? (
          <>
            <Box
              sx={{
                columnCount: { base: 1, md: 2, lg: 4 },
                columnGap: '16px',
                '& > div': {
                  breakInside: 'avoid',
                  marginBottom: '16px'
                }
              }}
            >
              {visibleItems.map(item => {
                const itemId = item._id ?? (item as VideoAlternative).dbId ?? '';
                return (
                  <LibraryItem
                    key={itemId}
                    item={item}
                    videoUrl={'link' in item ? item.link : item.preview ? item.preview : item.url}
                    isOwner={isOwner}
                    deleteId={itemId}
                    onDelete={deleteBroll}
                    isSelected={selectedItems.has(itemId)}
                    onSelectionChange={handleSelectionChange}
                    isAdmin={userProfile?.isAdmin ?? false}
                    onFindSimilar={findSimilarVideos}
                  />
                );
              })}
            </Box>
          </>
        ) : isLoadingBroll ? (
          <GlobalSpinner />
        ) : (
          <Center h="200px">
            <Text>
              {library?.status === 'PROCESSING'
                ? 'Processing library...'
                : library?.status === 'FAILED'
                ? 'An error occurred while processing the library.'
                : library?.status === 'PROCESSED'
                ? 'This library has been processed but no suitable footage was found.'
                : 'Unknown library status.'}
            </Text>
          </Center>
        )}
      </Container>
    </>
  );
};
