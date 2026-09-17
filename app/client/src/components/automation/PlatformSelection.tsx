import { FC, useCallback, useEffect, useState } from 'react';
import {
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Heading,
  VStack,
  FormControl,
  FormLabel,
  FormHelperText,
  Switch,
  Select,
  Text,
  Link,
  useColorModeValue
} from '@chakra-ui/react';
import { Controller, useFormContext } from 'react-hook-form';
import { FaYoutube } from 'react-icons/fa';
import { AutomationConfigFormData } from '../../types';
import { useApiService } from '../../hooks/useApiService';
import { useUserId } from '../../contexts/firebase/hooks';

type YoutubeChannel = { channelId: string; channelTitle: string };

export const PlatformSelection: FC = () => {
  const { control, watch, setValue } = useFormContext<AutomationConfigFormData>();
  const bgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const textColor = useColorModeValue('white', 'white');

  const api = useApiService();
  const userId = useUserId();
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);

  const youtubeEnabled = watch('platforms.youtube.enabled');
  const selectedChannelId = watch('platforms.youtube.channelId');

  const fetchChannels = useCallback(async () => {
    const res = await api.get<{ channels: YoutubeChannel[] }>('/api/youtube/channels', { suppressToast: true });
    setChannels(res.channels || []);
  }, [api]);

  useEffect(() => {
    if (youtubeEnabled) fetchChannels();
  }, [youtubeEnabled, fetchChannels]);

  useEffect(() => {
    if (!selectedChannelId && channels[0]) {
      setValue('platforms.youtube.channelId', channels[0].channelId);
      setValue('platforms.youtube.channelName', channels[0].channelTitle);
    }
  }, [channels, selectedChannelId, setValue]);

  const onConnect = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/youtube/auth?user_id=${encodeURIComponent(
      userId
    )}&return_path=${encodeURIComponent(window.location.pathname)}`;
  };

  return (
    <AccordionItem
      borderTop="4px solid"
      borderTopColor="blue.400"
      borderLeft="1px solid"
      borderRight="1px solid"
      borderBottom="1px solid"
      borderLeftColor={borderColor}
      borderRightColor={borderColor}
      borderBottomColor={borderColor}
      borderRadius="lg"
      bg={bgColor}
      mb={4}
    >
      <AccordionButton py={4}>
        <Box flex="1" textAlign="left">
          <Heading as="h2" size="md" color={textColor}>
            Publishing
          </Heading>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4}>
        <VStack spacing={6} align="stretch">
          <FormControl display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <FormLabel htmlFor="youtube-enabled" color={textColor} mb={0} display="flex" alignItems="center" gap={2}>
                <FaYoutube /> Upload to YouTube automatically
              </FormLabel>
              <FormHelperText mt={1}>Each generated video is uploaded to your connected channel once it's ready.</FormHelperText>
            </Box>
            <Controller
              name="platforms.youtube.enabled"
              control={control}
              render={({ field }) => (
                <Switch id="youtube-enabled" isChecked={field.value} onChange={e => field.onChange(e.target.checked)} colorScheme="red" />
              )}
            />
          </FormControl>

          {youtubeEnabled && (
            <>
              <FormControl>
                <FormLabel color={textColor}>YouTube channel</FormLabel>
                {channels.length === 0 ? (
                  <Text color="gray.300" fontSize="sm">
                    No YouTube channel connected yet.{' '}
                    <Link color="blue.300" onClick={onConnect}>
                      Connect one
                    </Link>
                    .
                  </Text>
                ) : (
                  <Controller
                    name="platforms.youtube.channelId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        onChange={e => {
                          field.onChange(e.target.value);
                          setValue(
                            'platforms.youtube.channelName',
                            channels.find(c => c.channelId === e.target.value)?.channelTitle
                          );
                        }}
                      >
                        {channels.map(c => (
                          <option key={c.channelId} value={c.channelId}>
                            {c.channelTitle}
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                )}
              </FormControl>

              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <FormLabel htmlFor="youtube-public" color={textColor} mb={0}>
                    Publish as public
                  </FormLabel>
                  <FormHelperText mt={1}>
                    Off uploads as private so you can review each video before publishing it yourself.
                  </FormHelperText>
                </Box>
                <Controller
                  name="contentSettings.isPublic"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="youtube-public"
                      isChecked={field.value}
                      onChange={e => field.onChange(e.target.checked)}
                      colorScheme="red"
                    />
                  )}
                />
              </FormControl>
            </>
          )}
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};
