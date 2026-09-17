import { FC, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Heading,
  Text,
  useToast,
  Box,
  Input,
  Button,
  Flex,
  useBreakpointValue,
  HStack,
  Icon,
  VStack
} from '@chakra-ui/react';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { Link as RouterLink } from 'react-router-dom';
import { useApiService } from '../../hooks/useApiService';
import { ExportJob, VideoAIData } from '../../types';
import { FaCalendar, FaCheck, FaDownload, FaEdit } from 'react-icons/fa';
import { UploadToYouTubeButton } from './UploadToYouTubeButton';

const Export: FC<{ data: ExportJob & { videoDataId: VideoAIData } }> = ({ data }) => {
  const backButtonText = useBreakpointValue({ base: 'Edit Video', md: 'Back to Project' });
  const toast = useToast();
  const link = useMemo(() => {
    if (data.videoDataId?.highlightInstanceId) {
      return `/highlight/${data.videoDataId?.highlightId}/${data.videoDataId?.highlightInstanceId}`;
    } else {
      return `/videos/${data.videoDataId?._id}`;
    }
  }, [data]);

  const actionButtons = (
    <>
      <Button leftIcon={<FaEdit />} variant="outline" as={RouterLink} to={link}>
        {backButtonText}
      </Button>
      <Button
        leftIcon={<FaDownload />}
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(data.videoUrl);
          toast({
            title: 'Link copied to clipboard',
            status: 'success',
            duration: 2000,
            isClosable: true
          });
        }}
      >
        Copy Link
      </Button>
      <Button
        leftIcon={<FaDownload />}
        colorScheme="white"
        as={RouterLink}
        to={data.videoUrl}
        download={`${encodeURIComponent(data.videoDataId.title || 'video')}.mp4`}
        target="_blank"
      >
        Download
      </Button>
      {data.exportType !== 'FCPXML' && (
        <UploadToYouTubeButton videoUrl={data.videoUrl} defaultTitle={data.videoDataId.title} />
      )}
    </>
  );

  return (
    <Container
      minW={{ base: '100%', md: '600px', lg: '800px' }}
      flexDirection={data.orientationType === 'VERTICAL' ? 'row' : 'column'}
      display="flex"
      gap={8}
    >
      <Heading
        mt="10"
        display="flex"
        gap={8}
        alignItems={data.orientationType === 'VERTICAL' ? 'flex-start' : 'center'}
        justifyContent={data.orientationType === 'VERTICAL' ? 'flex-start' : 'space-between'}
        flexDirection={data.orientationType === 'VERTICAL' ? 'column' : 'row'}
      >
        {data.videoDataId.title}
        {data.orientationType === 'VERTICAL' && (
          <Flex gap={4} flexDirection={{ base: 'column', md: 'column' }} justifyContent="flex-end" flexWrap="wrap">
            {actionButtons}
          </Flex>
        )}
      </Heading>
      <HStack justifyContent="flex-start" alignItems="center" gap={4} flexWrap="wrap">
        {data.orientationType === 'HORIZONTAL' && actionButtons}
      </HStack>
      <Box mb={8} pt={data.orientationType === 'VERTICAL' ? 12 : 0} w="100%">
        <Box mb={8} borderRadius="md" overflow="hidden">
          {data.exportType !== 'FCPXML' && <video controls src={data.videoUrl} style={{ maxHeight: '50vh' }}></video>}
        </Box>
        {data.exportType === 'FCPXML' && (
          <Box bg="gray.900" borderColor="gray.800" borderWidth={1} borderRadius="md" p={6}>
            <VStack spacing={6} align="stretch">
              <HStack spacing={4}>
                <Flex w={12} h={12} bg="green.500" borderRadius="full" alignItems="center" justifyContent="center">
                  <Icon as={FaCheck} w={6} h={6} color="white" />
                </Flex>
                <Box>
                  <Heading as="h2" size="md" color="white">
                    Export Completed
                  </Heading>
                  <Text color="gray.400">Your XML project is ready for download</Text>
                </Box>
              </HStack>

              <HStack color="gray.400">
                <Icon as={FaCalendar} />
                <Text>Completed: {new Date(data.updatedAt!).toLocaleString()}</Text>
              </HStack>
            </VStack>
          </Box>
        )}
      </Box>
      {data.extraVideoUrl && (
        <Box>
          <Heading size="sm" mb={8}>
            Horizontal
          </Heading>
          <Box mb={8} borderRadius="md" overflow="hidden">
            <video controls src={data.extraVideoUrl} style={{ maxHeight: '50vh' }}></video>
          </Box>
          <Input defaultValue={data.extraVideoUrl} />
          <RouterLink to={data.extraVideoUrl} download="realitycuts-export" target="_blank" rel="noreferrer">
            Click to download file
          </RouterLink>
        </Box>
      )}
    </Container>
  );
};

export const ExportDetailsPage = () => {
  const { id } = useParams();
  const [data, setData] = useState<ExportJob & { videoDataId: VideoAIData }>();
  const apiService = useApiService();
  const toast = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setData(await apiService.get<ExportJob & { videoDataId: VideoAIData }>(`/api/exports/${id}`));
      } catch (error) {
        const err = error as { message?: string };
        err?.message && toast({ description: err.message, title: 'An error occurred!', status: 'error' });
      }
    };
    if (id) {
      fetchData();
    }
  }, [id, toast, apiService]);

  return data ? <Export data={data} /> : <GlobalSpinner />;
};
