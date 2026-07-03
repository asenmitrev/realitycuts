import { FC, useState } from 'react';
import { Audio } from '../../types';
import {
  Modal,
  ModalOverlay,
  Grid,
  GridItem,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Image,
  FormLabel,
  FormErrorMessage,
  FormControl,
  Input,
  Text,
  Box,
  ButtonGroup,
  Card,
  CardBody,
  CardFooter,
  Heading,
  Stack
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { useApiService } from '../../hooks/useApiService';
import { FaPlay } from 'react-icons/fa';

const AudioPreview: FC<{ audioAlt: Audio }> = ({ audioAlt }) => {
  const [isShowAudio, setIsShowAudio] = useState(false);
  return (
    <Box display="flex" alignItems="stretch" justifyContent="stretch" position="relative" borderRadius={0}>
      {!isShowAudio ? (
        <Box onClick={() => setIsShowAudio(v => !v)} cursor="pointer" w="100%">
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
          <Image src={audioAlt.thumbnailUrl} alt="Audio thumbnail." objectFit="cover" w="100%" h="300px" />
        </Box>
      ) : (
        <audio
          src={audioAlt.preview}
          autoPlay={true}
          controls
          style={{ objectFit: 'cover', height: '300px', width: '100%' }}
        ></audio>
      )}
    </Box>
  );
};

interface SearchAudioData {
  query: string;
}
interface SearchAudioModalProps {
  onAudioSelect: (alternatives: Audio[], keywords: string) => void;
  isOpen: boolean;
  onClose: () => void;
}
export const SearchAudioModal: FC<SearchAudioModalProps> = ({ onAudioSelect, isOpen, onClose }) => {
  const {
    handleSubmit,
    register,
    formState: { errors }
  } = useForm<SearchAudioData>({});
  const [isLoading, setIsLoading] = useState(false);
  const apiService = useApiService();
  const [audios, setAudios] = useState<Audio[]>([]);
  const [keywords, setKeywords] = useState('');

  const searchAudio = async ({ query }: SearchAudioData) => {
    try {
      setIsLoading(true);
      setKeywords(query);
      const audios = await apiService.post<Audio[], SearchAudioData>('/api/search-audio', { query });
      setAudios(audios);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <form onSubmit={handleSubmit(searchAudio)}>
        <ModalContent minH="40vh">
          <ModalHeader>Search Audio Tracks</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isInvalid={!!errors.query?.message} mb={6}>
              <FormLabel>Search term:</FormLabel>
              <Input
                {...register('query', {
                  required: 'Search term is required.'
                })}
                type="text"
              />
              <FormErrorMessage>{errors.query?.message?.toString()}</FormErrorMessage>
            </FormControl>

            {audios?.length ? (
              <Grid
                templateColumns={{ md: 'repeat(3, 1fr)', sm: 'repeat(2,1fr)', base: 'repeat(1,1fr)' }}
                gridTemplateRows="masonry"
                gap={6}
              >
                {audios.map((audioAlt, index) => (
                  <GridItem w="100%" key={index} display="flex">
                    <Card flexGrow="1">
                      <AudioPreview audioAlt={audioAlt} />
                      <CardBody flexGrow="1" display="flex" flexDirection="column">
                        <Stack mt="6" spacing="3" flexGrow="1">
                          <Heading size="md">{audioAlt.title}</Heading>
                        </Stack>
                      </CardBody>
                      <CardFooter>
                        <ButtonGroup spacing="2">
                          <Button
                            variant="solid"
                            colorScheme="white"
                            onClick={e => {
                              e.preventDefault();
                              onAudioSelect([audioAlt], keywords);
                              setAudios([]);
                              onClose();
                            }}
                          >
                            Select Audio
                          </Button>
                        </ButtonGroup>
                      </CardFooter>
                    </Card>
                  </GridItem>
                ))}
              </Grid>
            ) : (
              <Text mt={8}>No audio found for your search term.</Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="solid" colorScheme="white" isLoading={isLoading} type="submit">
              Search
            </Button>
            <Button variant="outline" colorScheme="gray" ml={4} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </form>
    </Modal>
  );
};
