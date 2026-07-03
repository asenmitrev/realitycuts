import { Button, Flex } from '@chakra-ui/react';
import { useState, useMemo } from 'react';

export function usePagination<T>(data: T[], pageSize: number) {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = pageSize;
  const totalPages = Math.ceil((data?.length || 0) / itemsPerPage);
  const paginatedItems =
    useMemo(
      () => data?.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage),
      [data, currentPage, itemsPerPage]
    ) ?? [];

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const PaginationControls = () => (
    <Flex justify="center" mt={4} gap={2} wrap="wrap">
      <Button size="sm" onClick={() => handlePageChange(currentPage - 1)} isDisabled={currentPage === 0}>
        Previous
      </Button>
      {[...Array(totalPages)].map((_, index) => (
        <Button
          key={index}
          size="sm"
          colorScheme={currentPage === index ? 'blue' : 'gray'}
          onClick={() => handlePageChange(index)}
        >
          {index + 1}
        </Button>
      ))}
      <Button size="sm" onClick={() => handlePageChange(currentPage + 1)} isDisabled={currentPage === totalPages - 1}>
        Next
      </Button>
    </Flex>
  );

  return { paginatedItems, PaginationControls };
}
