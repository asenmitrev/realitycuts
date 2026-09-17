import { FC, useCallback, useEffect, useState } from 'react';
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  useToast,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Text,
  Link
} from '@chakra-ui/react';
import { FaYoutube } from 'react-icons/fa';
import { Link as RouterLink } from 'react-router-dom';
import { useApiService } from '../../hooks/useApiService';

type YoutubeChannel = { channelId: string; channelTitle: string };

export const UploadToYouTubeButton: FC<{ videoUrl: string; defaultTitle?: string }> = ({ videoUrl, defaultTitle }) => {
  const api = useApiService();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [channelId, setChannelId] = useState('');
  const [title, setTitle] = useState(defaultTitle ?? '');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  const fetchChannels = useCallback(async () => {
    setIsLoadingChannels(true);
    try {
      const res = await api.get<{ channels: YoutubeChannel[] }>('/api/youtube/channels', { suppressToast: true });
      setChannels(res.channels || []);
      setChannelId(res.channels?.[0]?.channelId ?? '');
    } finally {
      setIsLoadingChannels(false);
    }
  }, [api]);

  useEffect(() => {
    if (isOpen) fetchChannels();
  }, [isOpen, fetchChannels]);

  const onUpload = async () => {
    setIsUploading(true);
    try {
      const result = await api.post<{ youtubeUrl: string }, { videoUrl: string; videoTitle: string; description?: string; channelId: string }>(
        '/api/youtube/upload',
        { videoUrl, videoTitle: title, description, channelId }
      );
      toast({ title: 'Uploaded to YouTube as a private video', status: 'success' });
      window.open(result.youtubeUrl, '_blank');
      onClose();
    } catch (e) {
      toast({ title: 'Upload to YouTube failed', description: (e as Error)?.message, status: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Button leftIcon={<FaYoutube />} variant="outline" colorScheme="red" onClick={onOpen}>
        Upload to YouTube
      </Button>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upload to YouTube</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {!isLoadingChannels && channels.length === 0 ? (
              <Text color="gray.300">
                No YouTube channel connected yet.{' '}
                <Link as={RouterLink} to="/youtube" color="blue.300">
                  Connect one
                </Link>
                .
              </Text>
            ) : (
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Channel</FormLabel>
                  <Select value={channelId} onChange={e => setChannelId(e.target.value)}>
                    {channels.map(c => (
                      <option key={c.channelId} value={c.channelId}>
                        {c.channelTitle}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Title</FormLabel>
                  <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
                </FormControl>
                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} />
                </FormControl>
                <Text fontSize="sm" color="gray.400">
                  The video is uploaded as private so you can review it before publishing it yourself.
                </Text>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onClose} isDisabled={isUploading}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              leftIcon={<FaYoutube />}
              onClick={onUpload}
              isLoading={isUploading}
              isDisabled={!channelId || !title}
            >
              Upload
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
