import { Button, Flex, Box, IconButton, useColorModeValue, useBreakpointValue } from '@chakra-ui/react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { memo } from 'react';

export const Pagination = memo(function Pagination({
  currentPage,
  pageSize,
  total,
  handlePageChange
}: {
  currentPage: number;
  pageSize: number;
  total: number;
  handlePageChange: (newPage: number) => void;
}) {
  const itemsPerPage = pageSize;
  const totalPages = Math.ceil(total / itemsPerPage);

  // For smaller screens, show fewer page numbers
  const visiblePages = () => {
    const pages = Array.from({ length: totalPages }, (_, i) => i);

    if (totalPages <= 7) return pages;

    if (currentPage <= 3) {
      return [...pages.slice(0, 5), 'ellipsis', totalPages - 1];
    } else if (currentPage >= totalPages - 3) {
      return [0, 'ellipsis', ...pages.slice(totalPages - 5)];
    } else {
      return [0, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages - 1];
    }
  };

  // Styles
  const bgColor = useColorModeValue('blackAlpha.800', 'blackAlpha.800');
  const activeBgColor = useColorModeValue('blue.500', 'blue.500');
  const textColor = useColorModeValue('white', 'white');
  const hoverBgColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const buttonSize = useBreakpointValue({ base: 'xs', md: 'sm' });
  const iconSize = useBreakpointValue({ base: '14px', md: '16px' });

  return (
    <Box position="sticky" top="4" zIndex="10" width="100%" display="flex" justifyContent="center" mb={4}>
      <Flex
        bg={bgColor}
        backdropFilter="blur(8px)"
        borderRadius="full"
        px={3}
        py={2}
        alignItems="center"
        boxShadow="md"
      >
        <IconButton
          aria-label="Previous page"
          icon={<FaChevronLeft size={iconSize} />}
          size={buttonSize}
          variant="ghost"
          color={textColor}
          isDisabled={currentPage === 0}
          onClick={() => handlePageChange(currentPage - 1)}
          borderRadius="full"
          _hover={{ bg: hoverBgColor }}
          mr={1}
        />

        <Flex alignItems="center" gap={1}>
          {visiblePages().map((page, index) =>
            page === 'ellipsis' ? (
              <Box key={`ellipsis-${index}`} color="whiteAlpha.700" fontSize="xs" px={1}>
                ...
              </Box>
            ) : (
              <Button
                key={`page-${page}`}
                size={buttonSize}
                borderRadius="full"
                minW="32px"
                height="32px"
                p={0}
                bg={currentPage === page ? activeBgColor : 'transparent'}
                color={textColor}
                _hover={{ bg: currentPage === page ? activeBgColor : hoverBgColor }}
                onClick={() => handlePageChange(Number(page))}
              >
                {Number(page) + 1}
              </Button>
            )
          )}
        </Flex>

        <IconButton
          aria-label="Next page"
          icon={<FaChevronRight size={iconSize} />}
          size={buttonSize}
          variant="ghost"
          color={textColor}
          isDisabled={currentPage === totalPages - 1}
          onClick={() => handlePageChange(currentPage + 1)}
          borderRadius="full"
          _hover={{ bg: hoverBgColor }}
          ml={1}
        />
      </Flex>
    </Box>
  );
});
