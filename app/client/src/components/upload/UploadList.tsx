import { FC, useEffect, useState } from 'react';
import { UPLOAD_PROGRESS_STATUS, UploadProgress } from '../../types';
import 'rc-slider/assets/index.css';
import { Button, Image, Card, CardBody, Heading, SimpleGrid, Container, useToast, Box, Badge } from '@chakra-ui/react';
import { useApiService } from '../../hooks/useApiService';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { Link } from 'react-router-dom';
import { FaTrash } from 'react-icons/fa';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

const getStatusColor = (status: UPLOAD_PROGRESS_STATUS) => {
  if (status === 'FAILED') {
    return 'red';
  } else if (status === 'INSUFFICIENT_FOOTAGE') {
    return 'orange';
  } else if (status === 'COMPLETED') {
    return 'green';
  } else {
    return 'teal';
  }
};
interface UploadCardProps {
  data: UploadProgress;
  onDelete?: (id: string) => void;
}
const UploadCard: FC<UploadCardProps> = ({ data, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteUpload = async () => {
    setIsDeleting(true);
    try {
      await onDelete?.(data._id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <Box display="flex" alignItems="stretch" justifyContent="stretch" position="relative" borderRadius={0}>
        <Box position="absolute" top="18px" right="24px">
          <Badge variant="solid" ml={4} colorScheme={getStatusColor(data.status)}>
            {data.status}
          </Badge>
          <Badge variant="solid" ml={4} colorScheme="green">
            {data.jobType ?? 'B_ROLL'}
          </Badge>
        </Box>
        <Image
          src={data.thumbnailUrl ?? 'https://placehold.co/800?text=Upload+in+progress&font=roboto'}
          alt="Video thumbnail."
          objectFit="cover"
          w="100%"
          h="300px"
        />
      </Box>
      <CardBody flexGrow="1" display="flex" flexDirection="column">
        <Heading size="md" fontFamily="IBM Plex Sans Hebrew, sans-serif">
          <Link to={`/upload-progress/${data._id}`}>{data.title ?? 'New video'}</Link>
          {onDelete && (
            <Button isLoading={isDeleting} variant="ghost" colorScheme="red" onClick={deleteUpload}>
              <FaTrash />
            </Button>
          )}
        </Heading>
      </CardBody>
    </Card>
  );
};

interface UploadListProps {
  data: UploadProgress[];
  onDelete?: (id: string) => void;
}

export const UploadList: FC<UploadListProps> = ({ data, onDelete }) => {
  return (
    <SimpleGrid spacing={4} spacingY={10} columns={{ base: 1, md: 2, xl: 3 }}>
      {data.map(d => (
        <UploadCard onDelete={onDelete} data={d} key={d._id} />
      ))}
    </SimpleGrid>
  );
};

export const UploadListPage: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<UploadProgress[]>();
  const apiService = useApiService();
  const toast = useToast();
  const { renderDialog, awaitConfirmation } = useConfirmDialog({ title: 'Delete Upload', type: 'delete' });
  const deleteVideo = async (id: string) => {
    // You can write the URL of your server or any other endpoint used for file upload
    try {
      await awaitConfirmation();
      await apiService.delete(`/api/transcription-jobs/${id}`);
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
        setVideos(await apiService.get('/api/transcription-jobs'));
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
        Uploads in Progress
      </Heading>
      {videos?.length ? (
        <UploadList data={videos} onDelete={deleteVideo} />
      ) : isLoading ? (
        <GlobalSpinner />
      ) : (
        'No videos yet'
      )}
      {renderDialog()}
    </Container>
  );
};
