import {
  Box,
  VStack,
  HStack,
  Text,
  Link,
  Progress,
  IconButton,
  Badge,
  useDisclosure,
  Collapse,
  Card,
  CardHeader,
  CardBody,
  Button
} from '@chakra-ui/react';
import { FaFile, FaTrash, FaPlay } from 'react-icons/fa';
import { FaChevronDown } from 'react-icons/fa';
import { ILibrary, IPopulatedLibrary } from '../../types';
import { getStatusBadgeColor } from '../../utils/library';
import { memo, useState } from 'react';

export const LibraryDetailsAccordion = memo(function LibraryDetailsAccordion({
  youtubeLinks,
  processedFiles,
  libraryStatus,
  handleDeleteYoutubeLink,
  progress,
  youtubeLinkDeletionStatus
}: {
  youtubeLinks: { url: string; count: number }[];
  processedFiles: IPopulatedLibrary['processedFiles'];
  progress: number;
  libraryStatus: ILibrary['status'];
  handleDeleteYoutubeLink: (url: string) => void;
  youtubeLinkDeletionStatus: { [key: string]: true | false };
}) {
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: false });
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const filteredLinks = youtubeLinks.filter(link => link.url !== '');
  const displayLinks = showAllLinks ? filteredLinks : filteredLinks.slice(-5);
  const hasMoreLinks = filteredLinks.length > 5;

  const filteredFiles = processedFiles.filter(file => file.link);
  const displayFiles = showAllFiles ? filteredFiles : filteredFiles.slice(-5);
  const hasMoreFiles = filteredFiles.length > 5;

  return (
    <Card w="full" mb={4} borderRadius="lg" boxShadow="sm">
      <CardHeader
        as="button"
        onClick={onToggle}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth="1px"
        p={4}
        cursor="pointer"
        _hover={{ bg: 'whiteAlpha.50' }}
      >
        <Text fontSize="sm" fontWeight="semibold">
          Library Details
        </Text>
        <Box transform={isOpen ? 'rotate(180deg)' : 'none'} transition="transform 0.2s">
          <FaChevronDown />
        </Box>
      </CardHeader>

      <Collapse in={isOpen}>
        <CardBody p={6}>
          <VStack spacing={6} align="stretch">
            {/* Status Section */}
            <Box>
              <Text fontSize="sm" color="gray.600" mb={1.5}>
                Status
              </Text>
              <HStack>
                <Badge
                  display="flex"
                  alignItems="center"
                  gap={2}
                  px={2.5}
                  py={1}
                  colorScheme={getStatusBadgeColor(libraryStatus)}
                  rounded="md"
                >
                  <FaFile size={16} />
                  <Text>{libraryStatus}</Text>
                </Badge>
              </HStack>
            </Box>

            {/* YouTube Links Section */}
            <Box>
              <Text fontSize="sm" color="gray.600" mb={3}>
                YouTube Links {filteredLinks.length > 0 && `(${filteredLinks.length})`}
              </Text>
              <VStack spacing={2} align="stretch">
                {hasMoreLinks && !showAllLinks && (
                  <Button size="sm" variant="outline" onClick={() => setShowAllLinks(true)} mb={2}>
                    Show All Links
                  </Button>
                )}
                {displayLinks.map(({ url, count }, index) => (
                  <Box
                    key={index}
                    p={3}
                    borderWidth="1px"
                    borderRadius="lg"
                    display="flex"
                    alignItems="center"
                    gap={2}
                    role="group"
                    _groupHover={{ bg: 'whiteAlpha.50' }}
                    _hover={{ bg: 'whiteAlpha.50' }}
                    transition="background 0.2s"
                  >
                    <Box as={FaPlay} w={6} h={6} color="red.400" />
                    <Link
                      href={url}
                      flex={1}
                      fontSize="sm"
                      noOfLines={1}
                      _hover={{ textDecoration: 'underline' }}
                      target="_blank"
                      gap={4}
                    >
                      {url}{' '}
                    </Link>
                    <Text fontSize="xs" color="gray.500">
                      {count} b-rolls
                    </Text>
                    <IconButton
                      icon={<FaTrash size={16} />}
                      aria-label="Delete link"
                      variant="ghost"
                      size="sm"
                      color="red.500"
                      opacity={0}
                      onClick={() => handleDeleteYoutubeLink(url)}
                      isLoading={youtubeLinkDeletionStatus[url]}
                      _groupHover={{ opacity: 1 }}
                      transition="opacity 0.2s"
                    />
                  </Box>
                ))}
              </VStack>
            </Box>

            {/* Processed Files Section */}
            <Box>
              <Text fontSize="sm" color="gray.600" mb={3}>
                Processed Files ({filteredFiles.length})
              </Text>
              <VStack spacing={2} align="stretch">
                {hasMoreFiles && !showAllFiles && (
                  <Button size="sm" variant="outline" onClick={() => setShowAllFiles(true)} mb={2}>
                    Show All Files
                  </Button>
                )}
                {displayFiles.map((file, index) => (
                  <HStack key={index} p={3} borderWidth="1px" borderRadius="lg" spacing={2}>
                    <FaFile size={20} color="green" />
                    <Link href={file.link.url} target="_blank">
                      {file.link.originalName ?? ''}
                    </Link>
                    <Badge
                      colorScheme={file.status === 'FAILED' ? 'red' : file.status === 'PROCESSED' ? 'green' : 'blue'}
                    >
                      {file.status}
                    </Badge>
                  </HStack>
                ))}
              </VStack>
            </Box>

            {/* Progress Section */}
            {libraryStatus === 'PROCESSING' && (
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.600">
                    Progress
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {progress}%
                  </Text>
                </HStack>
                <Progress value={progress} size="sm" colorScheme="blue" borderRadius="full" />
              </Box>
            )}
          </VStack>
        </CardBody>
      </Collapse>
    </Card>
  );
});
