import { FC, useEffect, useState } from 'react';
import {
  Button,
  Heading,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  Text,
  Box,
  useDisclosure,
  ButtonGroup,
  DrawerHeader,
  Stack,
  IconButton,
  Icon,
  Flex,
  Switch
} from '@chakra-ui/react';
import { FormProvider, useForm } from 'react-hook-form';
import _ from 'lodash';
import { CaptionSettings } from '../../types';
import { FaDownload, FaStar, FaTrash } from 'react-icons/fa';
import { SaveCaptionModal } from './SaveCaptionModal';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useApiService } from '../../hooks/useApiService';
import preset1Image from '../../assets/captions/preset-1.png';
import preset2Image from '../../assets/captions/preset-2.png';
import preset3Image from '../../assets/captions/preset-3.png';
import preset4Image from '../../assets/captions/preset-4.png';
import preset5Image from '../../assets/captions/preset-5.png';
import preset6Image from '../../assets/captions/preset-6.png';
import { CAPTION_PRESETS } from 'shared/config/captions';
import { CaptionEditorForm } from './CaptionEditorForm';

export interface CaptionModalProps {
  videoAiDataId: string;
  isOpen: boolean;
  captions: CaptionSettings;
  captionPresets?: CaptionSettings[];
  onClose: () => void;
  downloadSubtitles: () => void;
  onSave: (data: CaptionSettings) => void;
  reloadCaptions: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const presets: CaptionSettings[] = CAPTION_PRESETS;
export type FormData = CaptionSettings & {
  position: 'top' | 'center' | 'bottom';
};

const presetImages: Record<string, string> = {
  'Preset 1': preset1Image,
  'Preset 2': preset2Image,
  'Preset 3': preset3Image,
  'Preset 4': preset4Image,
  'Preset 5': preset5Image,
  'Preset 6': preset6Image
};

const CaptionPreset = ({
  preset,
  isActive,
  reset,
  isDeleting,
  handleDelete,
  handleSetDefault
}: {
  preset: CaptionSettings;
  isActive: boolean;
  reset: (data: CaptionSettings) => void;
  isDeleting: Record<string, boolean>;
  handleDelete?: (id: string) => void;
  handleSetDefault?: (id: string) => void;
}) => {
  const presetImage = presetImages[preset.name ?? ''];

  return (
    <Button
      key={preset._id}
      as="div"
      variant={isActive ? 'solid' : 'outline'}
      colorScheme={isActive ? 'green' : 'gray'}
      justifyContent={presetImage ? 'center' : 'space-between'}
      size="lg"
      role="group"
      onClick={() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, ...rest } = preset;
        reset(rest);
      }}
    >
      {presetImage ? <Box as="img" src={presetImage} alt={preset.name} maxH="40px" objectFit="contain" /> : preset.name}

      <ButtonGroup>
        {handleDelete && (
          <IconButton
            aria-label="Delete"
            icon={<Icon as={FaTrash} color="red.500" />}
            _groupHover={{ opacity: 1 }}
            variant="ghost"
            size="sm"
            opacity={0}
            isLoading={isDeleting[preset._id!]}
            onClick={() => handleDelete(preset._id!)}
          />
        )}
        {handleSetDefault && (
          <IconButton
            aria-label={preset.isDefault ? 'Default preset' : 'Set as default'}
            icon={<Icon as={FaStar} color={preset.isDefault ? 'yellow.400' : 'gray.400'} />}
            variant="ghost"
            _groupHover={{ opacity: 1 }}
            size="sm"
            opacity={preset.isDefault ? 1 : 0}
            onClick={() => handleSetDefault(preset._id!)}
          />
        )}
      </ButtonGroup>
    </Button>
  );
};

export const CaptionModal: FC<CaptionModalProps> = ({
  captions,
  isOpen,
  captionPresets,
  reloadCaptions,
  onSave,
  downloadSubtitles,
  onClose
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const {
    isOpen: isCaptionSaveModalOpen,
    onOpen: onCaptionSaveModalOpen,
    onClose: onCaptionSaveModalClose
  } = useDisclosure();
  const methods = useForm<FormData>({
    defaultValues: {
      ...captions,
      maxCharactersPerLine: 40,
      position: 'bottom'
    }
  });
  const { handleSubmit, reset, watch } = methods;

  const values = watch();

  useEffect(() => {
    const subscription = watch(value => {
      onSave(value as unknown as CaptionSettings);
    });
    return () => subscription.unsubscribe();
  }, [watch, onSave]);

  const handleSetDefault = async (captionId: string) => {
    captionPresets?.forEach(preset => {
      const newPreset = { ...preset, isDefault: preset._id === captionId };
      if (!_.isEqual(newPreset, preset)) {
        onSave(newPreset);
      }
    });
  };

  const triggerSave = async () => {
    setIsSaving(true);
    try {
      onCaptionSaveModalOpen();
    } finally {
      setIsSaving(false);
    }
  };

  const apiService = useApiService();

  const { renderDialog, awaitConfirmation } = useConfirmDialog({
    title: 'Delete Caption',
    type: 'delete'
  });
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(prev => ({ ...prev, [id]: true }));
      await awaitConfirmation();

      await apiService.delete(`/api/captions/${id}`);

      reloadCaptions();
    } catch (error) {
      console.error('Error deleting caption:', error);
    } finally {
      setIsDeleting(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <Drawer isOpen={isOpen} placement="left" onClose={onClose} size={isEnabled ? 'lg' : 'xs'}>
      <DrawerContent
        bg="gray.800"
        borderLeft="1px solid"
        borderColor="gray.200"
        maxH="100vh"
        overflow="auto"
        boxShadow="0px 0px 10px rgba(255, 255, 255, 0.4)"
      >
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(triggerSave)}>
            <DrawerCloseButton alignSelf="center" />
            <DrawerHeader borderBottomWidth="1px">
              <Heading size="lg">Captions</Heading>
            </DrawerHeader>
            <DrawerBody>
              {isEnabled ? (
                <CaptionEditorForm />
              ) : (
                <>
                  <Stack spacing={6} py={4}>
                    {/* Download Button */}
                    <Button
                      leftIcon={<FaDownload />}
                      variant="outline"
                      justifyContent="start"
                      size="lg"
                      onClick={downloadSubtitles}
                    >
                      Download SRT File
                    </Button>

                    {/* Font Style Section */}
                    <Box>
                      <Flex justify="space-between" align="center" mb={4}>
                        <Text color="gray.400" fontSize="sm">
                          Choose your font style
                        </Text>
                      </Flex>

                      <Stack spacing={3}>
                        {captionPresets?.length && <Heading size="sm">Default</Heading>}
                        {presets.map(preset => {
                          const isActive = _.isEqual(preset, values);
                          return (
                            <CaptionPreset
                              key={preset._id}
                              preset={preset}
                              isActive={isActive}
                              reset={reset}
                              isDeleting={isDeleting}
                            />
                          );
                        })}

                        {captionPresets?.length && <Heading size="sm">Saved</Heading>}
                        {captionPresets?.map(preset => {
                          const isActive = _.isEqual(preset, values);
                          return (
                            <CaptionPreset
                              key={preset._id}
                              preset={preset}
                              isActive={isActive}
                              reset={reset}
                              isDeleting={isDeleting}
                              handleDelete={handleDelete}
                              handleSetDefault={handleSetDefault}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  </Stack>
                </>
              )}
            </DrawerBody>

            <DrawerFooter justifyContent="space-between" px={isEnabled ? 10 : undefined}>
              {/* Toggle Switch */}
              <Flex justify="space-between" gap={2} align="center">
                <Text color="gray.400" fontSize="sm">
                  Enable captions editor
                </Text>
                <Switch
                  size="md"
                  isChecked={isEnabled}
                  colorScheme="teal"
                  onChange={() => {
                    onSave(values);
                    setIsEnabled(v => !v);
                  }}
                />
              </Flex>
              {isEnabled ? (
                <ButtonGroup>
                  <Button variant="solid" colorScheme="white" isLoading={isSaving} type="submit">
                    Save
                  </Button>
                </ButtonGroup>
              ) : null}
            </DrawerFooter>
            <SaveCaptionModal
              captions={values}
              captionPresets={captionPresets}
              onClose={async () => {
                await reloadCaptions();
                onCaptionSaveModalClose();
              }}
              isOpen={isCaptionSaveModalOpen}
            />
          </form>
        </FormProvider>
        {renderDialog()}
      </DrawerContent>
    </Drawer>
  );
};
