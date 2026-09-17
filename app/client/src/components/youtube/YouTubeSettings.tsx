import { FC, useCallback, useEffect, useState } from 'react';
import { Box, Button, Container, Heading, HStack, IconButton, Text, useToast, VStack } from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { FaYoutube } from 'react-icons/fa';
import { useApiService } from '../../hooks/useApiService';
import { useUserId } from '../../contexts/auth/hooks';
import { useConfirmDialogV2 } from '../../hooks/useConfirmDialog';

type YoutubeChannel = { channelId: string; channelTitle: string };

export const YouTubeSettingsPage: FC = () => {
  const api = useApiService();
  const toast = useToast();
  const userId = useUserId();
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { dialogContent, awaitConfirmation } = useConfirmDialogV2({
    title: 'Disconnect this YouTube channel?',
    type: 'delete',
    confirmText: 'Disconnect',
    cancelText: 'Cancel'
  });

  const fetchChannels = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ channels: YoutubeChannel[] }>('/api/youtube/channels');
      setChannels(res.channels || []);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const onConnect = () => {
    const returnPath = '/youtube';
    window.location.href = `${import.meta.env.VITE_API_URL}/api/youtube/auth?user_id=${encodeURIComponent(
      userId
    )}&return_path=${encodeURIComponent(returnPath)}`;
  };

  const onDisconnect = async (channelId: string) => {
    await awaitConfirmation();
    setRemovingId(channelId);
    try {
      await api.delete(`/api/youtube/channels/${channelId}`);
      toast({ title: 'Channel disconnected', status: 'success' });
      fetchChannels();
    } catch (e) {
      toast({ title: 'Failed to disconnect channel', status: 'error' });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Container maxW="4xl" py={8}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={6}>
        <Heading size="lg">YouTube</Heading>
        <Button onClick={onConnect} colorScheme="red" leftIcon={<FaYoutube />}>
          Connect YouTube channel
        </Button>
      </Box>
      <Text color="gray.400" mb={6}>
        Connect a YouTube channel to upload exports directly from a video's export page. Uploads are created as{' '}
        <Text as="span" fontWeight="semibold">
          private
        </Text>{' '}
        so you can review them before publishing.
      </Text>
      {!isLoading && channels.length === 0 ? (
        <Text color="gray.300">No YouTube channel connected yet.</Text>
      ) : (
        <VStack align="stretch" spacing={3}>
          {channels.map(channel => (
            <HStack
              key={channel.channelId}
              justifyContent="space-between"
              borderWidth="1px"
              borderColor="whiteAlpha.300"
              borderRadius="md"
              p={4}
            >
              <HStack>
                <FaYoutube size={20} />
                <Text>{channel.channelTitle}</Text>
              </HStack>
              <IconButton
                aria-label="Disconnect channel"
                icon={<DeleteIcon />}
                size="sm"
                variant="ghost"
                colorScheme="red"
                isLoading={removingId === channel.channelId}
                onClick={() => onDisconnect(channel.channelId)}
              />
            </HStack>
          ))}
        </VStack>
      )}
      {dialogContent}
    </Container>
  );
};
