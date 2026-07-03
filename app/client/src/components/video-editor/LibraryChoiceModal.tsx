import { FC, useState } from 'react';
import { Segment, UploadFormData } from '../../types';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  Button,
  ButtonGroup,
  useToast,
  Text,
  Flex,
  Progress
} from '@chakra-ui/react';
import { FormProvider, useForm } from 'react-hook-form';
import { useApiService } from '../../hooks/useApiService';
import { LibraryChoice } from '../upload/LibraryChoice';
import { useMessages } from '../../hooks/useMessages';
interface RegenerateBrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  startTime: number;
  onRegenerateComplete: (segments: Segment[]) => void;
  endTime: number;
  videoId: string;
  privateLibraryIds?: string[];
  publicLibraryIds?: string[];
}
export const RegenerateBrollModal: FC<RegenerateBrollModalProps> = ({
  isOpen,
  onClose,
  startTime,
  endTime,
  videoId,
  onRegenerateComplete,
  privateLibraryIds = [],
  publicLibraryIds = []
}) => {
  const methods = useForm<UploadFormData>({
    defaultValues: {
      pexels: false,
      selectedTags: [],
      libraries: []
    }
  });

  const { handleSubmit, register } = methods;
  const [eventId, setEventId] = useState('');
  const messages = useMessages(eventId, 'MESSAGE');

  const lastMessage = messages?.[messages.length - 1];

  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const apiService = useApiService();

  const regenerateBroll = async ({ libraries, pexels, selectedTags }: UploadFormData) => {
    try {
      setIsLoading(true);

      const selectedTagIds = selectedTags.filter(t => t.libraryId === null).map(t => t.tag);

      const libraryIdsToSend = [
        ...(libraries?.filter(l => l.isSelected).map(l => l._id) ?? []),
        ...(selectedTags.filter(t => t.libraryId !== null).map(t => t.libraryId) ?? [])
      ];
      if (selectedTagIds.length === 0 && libraryIdsToSend.length === 0 && !pexels) {
        toast({
          description: 'You must select at least one library to upload.',
          status: 'error'
        });
        return;
      }
      const payload = {
        startTime,
        endTime,
        pexels,
        selectedTags: selectedTagIds,
        privateLibraryIds: libraryIdsToSend.filter(id => id !== null) as string[],
        eventId: crypto.randomUUID()
      };
      setEventId(payload.eventId);

      const result = await apiService.post<
        Segment[],
        {
          startTime: number;
          endTime: number;
          pexels: boolean;
          privateLibraryIds: string[];
          selectedTags: string[];
          eventId: string;
        }
      >(`/api/videos/${videoId}/regenerate-broll`, payload);
      onRegenerateComplete(result);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(regenerateBroll)}>
          <ModalContent>
            <ModalCloseButton />
            <ModalBody>
              <Flex minHeight="200px" alignItems="center" mb={8} justifyContent="center">
                <LibraryChoice
                  register={register}
                  uploadType="video"
                  privateLibraryIds={privateLibraryIds}
                  publicLibraryIds={publicLibraryIds}
                />
              </Flex>
              {lastMessage && (
                <Flex mb={4} flexDirection="column" alignItems="center">
                  <Progress
                    mb={4}
                    w="100%"
                    size="sm"
                    colorScheme="white"
                    borderRadius="full"
                    value={lastMessage.progress ?? 50}
                  />
                  <Text fontSize="sm">{lastMessage.progress ?? 0}% Complete</Text>
                  <Text fontSize="sm">{lastMessage.message}</Text>
                </Flex>
              )}
              <ButtonGroup gap={4} mb={4} justifyContent="flex-end" w="100%">
                <Button variant="solid" colorScheme="white" isLoading={isLoading} type="submit">
                  Regenerate B-roll
                </Button>
              </ButtonGroup>
            </ModalBody>
          </ModalContent>
        </form>
      </FormProvider>
    </Modal>
  );
};
