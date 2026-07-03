import { FC, useState } from 'react';
import { CaptionSettings } from '../../types';
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
  FormErrorMessage,
  FormControl,
  Heading,
  Input,
  RadioGroup,
  Radio,
  Stack,
  Select
} from '@chakra-ui/react';
import { FormProvider, useForm } from 'react-hook-form';
import { useApiService } from '../../hooks/useApiService';

interface SaveCaptionModalProps {
  isOpen: boolean;
  captions: CaptionSettings;
  captionPresets?: CaptionSettings[];
  onClose: () => void;
}

type FormData = { name: string; presetId: string };
export const SaveCaptionModal: FC<SaveCaptionModalProps> = ({ isOpen, captionPresets, captions, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const apiService = useApiService();
  const [saveOption, setSaveOption] = useState<'new' | 'overwrite'>('new');

  const methods = useForm<FormData>({
    defaultValues: {
      name: '',
      presetId: ''
    }
  });
  const {
    handleSubmit,
    register,
    formState: { errors }
  } = methods;

  const onSaveCaptionPreset = async (data: FormData) => {
    setIsLoading(true);
    try {
      saveOption === 'new'
        ? await apiService.post<void, CaptionSettings>(`/api/captions`, {
            ...captions,
            ...data
          })
        : await apiService.put<void, CaptionSettings>(`/api/captions/${data.presetId}`, {
            ...captions
          });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay backdropFilter="blur(5px)" />
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSaveCaptionPreset)}>
          <ModalContent>
            <ModalHeader borderBottomWidth="1px" pb={4}>
              <Heading size="lg" fontWeight="bold">
                Save Captions Preset
              </Heading>
            </ModalHeader>
            <ModalCloseButton top={4} right={4} />

            <ModalBody py={6}>
              <Stack spacing={6}>
                <RadioGroup
                  value={saveOption}
                  onChange={value => setSaveOption(value as 'new' | 'overwrite')}
                  colorScheme="white"
                >
                  <Stack spacing={4}>
                    <Radio value="overwrite" size="md">
                      Overwrite old preset
                    </Radio>
                    <Radio value="new" size="md">
                      Save a new preset
                    </Radio>
                  </Stack>
                </RadioGroup>

                {saveOption === 'new' ? (
                  <FormControl isInvalid={!!errors.name?.message}>
                    <FormLabel fontSize="sm" fontWeight="medium" color="gray.300">
                      Preset Name:
                    </FormLabel>
                    <Input
                      {...register('name', {
                        required: 'Preset name is required.'
                      })}
                      type="text"
                    />
                    <FormErrorMessage>{errors.name?.message?.toString()}</FormErrorMessage>
                  </FormControl>
                ) : (
                  <FormControl>
                    <FormLabel fontSize="sm" fontWeight="medium" color="gray.300">
                      Captions Preset
                    </FormLabel>
                    <Select {...register('presetId')}>
                      {captionPresets?.map(p => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Stack>
            </ModalBody>

            <ModalFooter borderTopWidth="1px" pt={4} justifyContent="flex-end" gap={3}>
              <Button variant="outline" onClick={onClose} type="button">
                Cancel
              </Button>
              <Button colorScheme="white" isLoading={isLoading} type="submit">
                Save
              </Button>
            </ModalFooter>
          </ModalContent>
        </form>
      </FormProvider>
    </Modal>
  );
};
