import { FC, useEffect, useState } from 'react';
import { EXPORT_JOB_STATUS, ExportJob, VideoAIData } from '../../types';
import 'rc-slider/assets/index.css';
import {
  Button,
  Image,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  Container,
  Text,
  useToast,
  Box,
  Badge,
  CardFooter
} from '@chakra-ui/react';
import { useApiService } from '../../hooks/useApiService';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { FaDownload, FaPlay, FaTrash, FaFileCode } from 'react-icons/fa';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

const getStatusColor = (status: EXPORT_JOB_STATUS) => {
  if (status === 'FAILED') {
    return 'red';
  } else if (status === 'COMPLETED') {
    return 'green';
  } else {
    return 'teal';
  }
};
interface ExportCardProps {
  data: ExportJob;
  onDelete?: (id: string) => void;
  onSubmitReview?: (id: string) => void;
}
export const ExportCard: FC<ExportCardProps> = ({ data, onSubmitReview, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const aiData = data.videoDataId as unknown as VideoAIData;
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isShowVideo, setIsShowVideo] = useState(false);
  const { renderDialog, awaitConfirmation } = useConfirmDialog({ title: 'Delete Export', type: 'delete' });
  const deleteUpload = async () => {
    setIsDeleting(true);
    try {
      await awaitConfirmation();
      await onDelete?.(data._id);
    } finally {
      setIsDeleting(false);
    }
  };

  const submitReview = async () => {
    setIsSubmittingReview(true);
    try {
      await onSubmitReview?.(data._id);
    } finally {
      setIsSubmittingReview(false);
    }
  };
  return (
    <Card>
      <Box display="flex" alignItems="stretch" justifyContent="stretch" position="relative" borderRadius={0}>
        <Badge
          ml={4}
          colorScheme={getStatusColor(data.status)}
          position="absolute"
          variant="solid"
          top="18px"
          right="24px"
        >
          {data.status}
        </Badge>
        {data.exportType === 'FCPXML' ? (
          <Box
            w="100%"
            aspectRatio={2}
            bgGradient="linear(to-br, purple.500, blue.600)"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              bgGradient="linear(to-br, rgba(255,255,255,0.1), rgba(255,255,255,0.05))"
              opacity={0.5}
            />
            <Box
              position="relative"
              zIndex={1}
              textAlign="center"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
            >
              <FaFileCode size={48} color="white" style={{ marginBottom: '12px', opacity: 0.9 }} />
              <Text
                fontSize="2xl"
                fontWeight="bold"
                color="white"
                letterSpacing="0.1em"
                textTransform="uppercase"
                textShadow="0 2px 4px rgba(0,0,0,0.2)"
              >
                FCPXML
              </Text>
            </Box>
          </Box>
        ) : !isShowVideo ? (
          <Box onClick={() => data.status === 'COMPLETED' && setIsShowVideo(v => !v)} cursor="pointer" w="100%">
            {data.status === 'COMPLETED' && (
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                backgroundColor="rgba(0,0,0,0.3)"
                borderRadius="50%"
                padding={4}
              >
                <FaPlay size={24} />
              </Box>
            )}
            <Image src={aiData?.source?.thumbnail} alt="Video thumbnail." objectFit="cover" w="100%" aspectRatio={2} />
          </Box>
        ) : (
          <video
            src={data.videoUrl}
            autoPlay={true}
            controls
            style={{ objectFit: 'cover', height: '300px', width: '100%' }}
          ></video>
        )}
      </Box>
      <CardBody flexGrow="1" display="flex" flexDirection="column">
        <Heading size="md" fontSize="24px" fontFamily="IBM Plex Sans Hebrew, sans-serif">
          <Link to={data.status === 'COMPLETED' ? `/exports/${data._id}` : `/export-progress/${data._id}`}>
            {aiData?.title ?? 'New video'}
          </Link>
          {data.status === 'COMPLETED' ? (
            <Link to={data.videoUrl} download="realitycuts-export" target="_blank" rel="noreferrer">
              <Button ml={2} variant="ghost" colorScheme="green">
                <FaDownload />
              </Button>
            </Link>
          ) : null}
          {onDelete && (
            <Button isLoading={isDeleting} variant="ghost" colorScheme="red" onClick={deleteUpload}>
              <FaTrash />
            </Button>
          )}
        </Heading>
        {data.createdAt && (
          <Text fontSize="sm" color="gray.300">
            {format(new Date(data.createdAt), 'MM/dd/y HH:mm:ss')}
          </Text>
        )}
      </CardBody>
      {onSubmitReview && (
        <CardFooter>
          <Button
            isDisabled={data.status !== 'COMPLETED' || isSubmittingReview}
            isLoading={isSubmittingReview}
            onClick={submitReview}
          >
            Submit for Review
          </Button>
        </CardFooter>
      )}
      {renderDialog()}
    </Card>
  );
};

interface ExportListProps {
  data: ExportJob[];
  onDelete?: (id: string) => void;
}

export const ExportList: FC<ExportListProps> = ({ data, onDelete }) => {
  return (
    <SimpleGrid spacing={4} spacingY={10} columns={{ base: 1, md: 2, xl: 3 }}>
      {data.map(d => (
        <ExportCard onDelete={onDelete} data={d} key={d._id} />
      ))}
    </SimpleGrid>
  );
};

export const ExportListPage: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<ExportJob[]>();
  const apiService = useApiService();
  const toast = useToast();

  const deleteVideo = async (id: string) => {
    // You can write the URL of your server or any other endpoint used for file upload
    try {
      await apiService.delete(`/api/exports/${id}`);
      setVideos(oldVideos => oldVideos?.filter(video => video._id !== id));
    } catch (error) {
      const err = error as { message?: string };
      toast({
        title: 'Error!',
        description: err.message ?? 'An error occurred deleting your upload.',
        status: 'error',
        duration: 2000,
        isClosable: true
      });
    }
  };
  useEffect(() => {
    setIsLoading(true);
    const getVideos = async () => {
      try {
        setVideos(await apiService.get('/api/exports'));
      } catch (error) {
        const err = error as { message?: string };
        toast({ title: err.message, status: 'error' });
      } finally {
        setIsLoading(false);
      }
    };
    getVideos();
  }, [apiService, toast]);

  return (
    <Container w="100%" maxW={{ base: '100%', md: '900px', lg: '1000', xl: '1200' }}>
      <Heading mb="12" mt="10">
        All Exports
      </Heading>
      {videos?.length ? (
        <ExportList data={videos} onDelete={deleteVideo} />
      ) : isLoading ? (
        <GlobalSpinner />
      ) : (
        'No videos yet'
      )}
    </Container>
  );
};
