import { FC, useRef, memo, useEffect } from 'react';
import { Box, Text, Radio, IconButton, HStack, Badge } from '@chakra-ui/react';
import { FaPause, FaPlay } from 'react-icons/fa';
import { useIsPlus } from '../../contexts/profile/hooks';

export type UIVoice = {
  name: string;
  id: string;
  tags: string[];
  preview: string;
  premium: boolean;
};
export const AudioChoice: FC<{ voice: UIVoice; isSelected: boolean; isPlaying: boolean; onPlay: () => void }> = memo(
  ({ voice, isSelected, isPlaying, onPlay }) => {
    const ref = useRef<HTMLAudioElement>(null);
    const isPlus = useIsPlus();
    const isDisabled = voice.premium && !isPlus;
    useEffect(() => {
      if (isPlaying) {
        ref.current?.play();
      } else {
        ref.current?.pause();
      }
    }, [isPlaying]);
    return (
      <Box
        borderRadius="xl"
        w={{ md: 'calc(33% - 9px)', base: '100%', sm: 'calc(50% - 8px)' }}
        bg={'whiteAlpha.100'}
        borderWidth="1px"
        borderColor={isSelected ? 'blue.400' : 'whiteAlpha.200'}
        transition="all 0.2s"
        _hover={{
          borderColor: 'blue.400',
          transform: 'translateY(-2px)',
          shadow: 'lg'
        }}
        cursor="pointer"
      >
        <Radio
          p={4}
          colorScheme="blue"
          display="flex"
          alignItems="center"
          justifyContent="stretch"
          value={voice.id}
          isDisabled={isDisabled}
          size="lg"
        >
          <HStack spacing={4} flexGrow={1} justify="space-between" w="100%">
            <HStack spacing={3}>
              <Text
                fontSize="lg"
                textTransform="capitalize"
                fontWeight="medium"
                color={isSelected ? 'white' : 'whiteAlpha.900'}
              >
                {voice.name}{' '}
              </Text>
            </HStack>
            <IconButton
              aria-label={`Play ${voice} voice sample`}
              icon={isPlaying ? <FaPause /> : <FaPlay />}
              variant="ghost"
              colorScheme="blue"
              size="sm"
              onClick={e => {
                e.preventDefault();
                onPlay();
              }}
              _hover={{
                bg: 'whiteAlpha.200'
              }}
            />
          </HStack>
          <audio src={voice.preview} style={{ display: 'none' }} ref={ref} />
        </Radio>
        {voice.tags.length > 0 && (
          <HStack gap={2} wrap="wrap" px={4} pb={4}>
            {voice.tags.map(tag => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </HStack>
        )}
      </Box>
    );
  }
);
