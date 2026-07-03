import { FC, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  FormLabel,
  FormControl,
  Textarea,
  FormHelperText
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { useApiService } from '../../hooks/useApiService';
import { useNavigate } from 'react-router-dom';

interface ReprocessLibraryData {
  prompt: string;
}
interface ReprocessLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryId: string;
}
export const ReprocessLibraryModal: FC<ReprocessLibraryModalProps> = ({ libraryId, isOpen, onClose }) => {
  const {
    handleSubmit,
    register,
    formState: { errors }
  } = useForm<ReprocessLibraryData>({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const apiService = useApiService();

  const reprocessLibrary = async ({ prompt }: ReprocessLibraryData) => {
    try {
      setIsLoading(true);
      await apiService.post(`/api/library/${libraryId}/reprocess`, { prompt });
      navigate(`/libraries`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <form onSubmit={handleSubmit(reprocessLibrary)}>
        <ModalContent minH="40vh">
          <ModalHeader>Search Audio Tracks</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isInvalid={!!errors.prompt}>
              <FormLabel>Prompt:</FormLabel>
              <Textarea {...register('prompt')} rows={6} />
              <FormHelperText>
                Reprocessing the library will reclassify all of the footage inside based on the new prompt you give it.
                You can include explanation on people in your videos, what details you would like to include in
                classifications, etc.
              </FormHelperText>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="solid" colorScheme="white" isLoading={isLoading} type="submit">
              Reprocess
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
