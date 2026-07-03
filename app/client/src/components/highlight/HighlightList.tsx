import { FC, useState } from 'react';
import { IHighlightData, IHighlightInstance } from '../../types';
import 'rc-slider/assets/index.css';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Image,
  Card,
  CardBody,
  CardFooter,
  Heading,
  SimpleGrid,
  Container,
  useToast,
  Box,
  Flex,
  Input
} from '@chakra-ui/react';
import { useApiService } from '../../hooks/useApiService';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { FaPlay, FaRegEdit, FaSave, FaTrash } from 'react-icons/fa';
import { useQuery, useQueryClient } from 'react-query';
import { useUserId } from '../../contexts/firebase/hooks';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

export type IHighlightDataPopulated = Omit<IHighlightData, 'highlights' | '_id'> & {
  _id: string;
  highlights: IHighlightInstance[];
};
interface HighlightCard {
  data: IHighlightDataPopulated;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, title: string) => void;
}
const HighlightCard: FC<HighlightCard> = ({ data, onDelete, onEdit }) => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShowVideo, setIsShowVideo] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(data.title);
  const editVideo = async () => {
    setIsSaving(true);
    try {
      await onEdit?.(data._id, editedTitle);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };
  const deleteVideo = async () => {
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
        {!isShowVideo ? (
          <Box onClick={() => setIsShowVideo(v => !v)} cursor="pointer" w="100%">
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
            <Image src={data.source?.thumbnail} alt="Video thumbnail." objectFit="cover" w="100%" h="300px" />
          </Box>
        ) : (
          <video
            src={data.source.url}
            autoPlay={true}
            controls
            style={{ objectFit: 'cover', height: '300px', width: '100%' }}
          ></video>
        )}
      </Box>
      <CardBody display="flex" flexDirection="column" flexGrow="0">
        <Heading
          size="md"
          display="flex"
          gap={4}
          justifyContent="space-between"
          alignItems="center"
          fontFamily="IBM Plex Sans Hebrew, sans-serif"
          fontSize="24px"
        >
          {!isEditing ? (
            <>
              {data.title}
              <Flex gap={1}>
                {onEdit && (
                  <Button flexShrink={0} variant="ghost" onClick={() => setIsEditing(true)}>
                    <FaRegEdit />
                  </Button>
                )}
                {onDelete && (
                  <Button flexShrink={0} isLoading={isDeleting} variant="ghost" colorScheme="red" onClick={deleteVideo}>
                    <FaTrash />
                  </Button>
                )}
              </Flex>
            </>
          ) : (
            <Flex gap={3} flexGrow="1" alignItems="center">
              <Input flexGrow="1" onChange={e => setEditedTitle(e.target.value)} value={editedTitle} />
              <Button variant="ghost" size="md" fontSize="larger" isLoading={isSaving}>
                <FaSave onClick={editVideo} />
              </Button>
            </Flex>
          )}
        </Heading>
      </CardBody>
      <CardFooter flexGrow="1" alignItems="flex-start" justifyContent="flex-start">
        <Flex gap={4} flexWrap="wrap" maxW="100%">
          {data.highlights.map((hl, index) => {
            return (
              <Button
                variant={hl.isAcceptedForEditing ? 'solid' : 'outline'}
                key={hl._id}
                colorScheme={hl.isAcceptedForEditing ? 'green' : 'gray'}
                onClick={() => {
                  navigate(`/highlight/${data._id}/${hl._id}`);
                }}
                maxW="30%"
                whiteSpace="nowrap"
                textOverflow="ellipsis"
                overflow="hidden"
                display="block"
              >
                {hl.title ?? `Highlight ${index + 1}`}
              </Button>
            );
          })}
        </Flex>
      </CardFooter>
    </Card>
  );
};

interface HighlightListProps {
  data: IHighlightDataPopulated[];
  onDelete?: (id: string) => void;
  onEdit?: (id: string, title: string) => void;
}

export const HighlightList: FC<HighlightListProps> = ({ data, onEdit, onDelete }) => {
  return (
    <SimpleGrid spacing={4} spacingY={10} columns={{ base: 1 }}>
      {data.map(d => (
        <HighlightCard onDelete={onDelete} onEdit={onEdit} data={d} key={d._id} />
      ))}
    </SimpleGrid>
  );
};

export const HighlightListPage: FC = () => {
  const apiService = useApiService();

  const toast = useToast();
  const userId = useUserId();
  const queryKeyHls = ['highlightsListHome', userId];
  const { isLoading, data: videos } = useQuery({
    queryKey: queryKeyHls,
    refetchOnMount: 'always',
    queryFn: async () => {
      return await apiService.get<IHighlightDataPopulated[]>(`/api/highlights`);
    }
  });

  const { renderDialog, awaitConfirmation } = useConfirmDialog({ title: 'Delete Highlight', type: 'delete' });
  const queryClient = useQueryClient();

  const deleteVideo = async (id: string) => {
    // You can write the URL of your server or any other endpoint used for file upload
    try {
      await awaitConfirmation();
      await apiService.delete(`/api/highlights/${id}`);
      queryClient.setQueryData<IHighlightDataPopulated[] | undefined>(queryKeyHls, oldData =>
        oldData?.filter(v => v._id !== id)
      );
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
  const editVideo = async (id: string, title: string) => {
    // You can write the URL of your server or any other endpoint used for file upload
    try {
      await apiService.put(`/api/highlights/${id}`, { title });
      queryClient.setQueryData<IHighlightDataPopulated[] | undefined>(queryKeyHls, oldData =>
        oldData?.map(v => (v._id === id ? { ...v, title } : v))
      );
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

  return (
    <Container w="100%" maxW={{ base: '100%', md: '900px', lg: '1000', xl: '1200' }}>
      <Heading mb="12" mt="10" display="flex" alignItems="center" justifyContent="space-between" gap={12}>
        Highlights
      </Heading>
      {videos?.length ? (
        <HighlightList data={videos} onDelete={deleteVideo} onEdit={editVideo} />
      ) : isLoading ? (
        <GlobalSpinner />
      ) : (
        'No videos yet'
      )}
      {renderDialog()}
    </Container>
  );
};
