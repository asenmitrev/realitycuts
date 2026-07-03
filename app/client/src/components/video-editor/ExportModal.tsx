'use client';

import { type FC, useEffect, useState } from 'react';
import type { CaptionSettings, OrientationType } from '../../types';
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
  Flex,
  Heading,
  FormHelperText,
  Checkbox,
  Select,
  VStack,
  Divider,
  IconButton,
  Switch,
  HStack,
  Box,
  Collapse,
  useDisclosure
} from '@chakra-ui/react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useApiService } from '../../hooks/useApiService';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../../contexts/profile/hooks';
import { useUserId } from '../../contexts/firebase/hooks';
import { FaPlus, FaCog } from 'react-icons/fa';
import { IoPhoneLandscapeOutline, IoPhonePortraitOutline } from 'react-icons/io5';

import { useQuery } from 'react-query';

interface ExportModalProps {
  videoAiDataId: string;
  videoTitle: string | undefined;
  orientationType: OrientationType;
  isOpen: boolean;
  isHighlight: boolean;
  canExportVertical: boolean;
  captions?: CaptionSettings;
  onClose: () => void;
  onSave: (title?: string) => void;
}

interface FormData {
  exportType: 'VIDEO' | 'VIDEO_CAPTIONS' | 'FCPXML';
  orientationType: OrientationType;
  brandWatermarkUploadId?: string;
  brandWatermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  generateThumbnail?: boolean;
}

export const ExportModal: FC<ExportModalProps> = ({
  videoAiDataId,
  videoTitle,
  canExportVertical,
  orientationType,
  isOpen,
  onClose,
  onSave
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen: isAdvancedOpen, onToggle: onAdvancedToggle, onOpen: onAdvancedOpen } = useDisclosure();
  const apiService = useApiService();
  const navigate = useNavigate();
  const userId = useUserId();
  const localStorageKey = `exportModal-${userId}`;
  const userProfile = useProfile();
  const hasBrandEntitlement = (userProfile?.entitlements ?? []).some(e => e.name === 'brand-watermark');

  const methods = useForm<FormData>({
    defaultValues: localStorage.getItem(localStorageKey)
      ? {
        ...JSON.parse(localStorage.getItem(localStorageKey)!),
        orientationType
      }
      : {
        exportType: 'VIDEO',
        orientationType
      }
  });

  const {
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = methods;
  const exportType = watch('exportType');

  useEffect(() => {
    if (exportType === 'FCPXML' && !isAdvancedOpen) {
      onAdvancedOpen();
    }
  }, [exportType, isAdvancedOpen, onAdvancedOpen]);

  // Disable generateThumbnail when orientation changes to vertical
  useEffect(() => {
    if (orientationType === 'VERTICAL' && watch('generateThumbnail')) {
      setValue('generateThumbnail', false, { shouldDirty: true });
    }
  }, [orientationType, setValue, watch]);

  const { data: brandAssets = [] } = useQuery({
    queryKey: ['brandAssets', userId],
    queryFn: async (): Promise<{ _id: string; name?: string }[]> => {
      const response = await apiService.get<{ assets: { _id: string; name?: string }[] }>(`/api/brand-assets`);
      return response.assets ?? [];
    },
    enabled: hasBrandEntitlement && !!userId
  });

  const onStartExport = async (data: FormData) => {
    setIsLoading(true);
    localStorage.setItem(
      localStorageKey,
      JSON.stringify({
        exportType: data.exportType,
        brandWatermarkUploadId: data.brandWatermarkUploadId,
        brandWatermarkPosition: data.brandWatermarkPosition
      })
    );
    await onSave(videoTitle);
    try {
      if (data.exportType === 'FCPXML') {
        const { eventId } = await apiService.post<{ eventId: string }, { exportType: string }>(
          `/api/videos/${videoAiDataId}/export/fcpxml`,
          { exportType: 'FCPXML' }
        );
        navigate(`/export-progress/${eventId}`);
      } else {
        const { eventId } = await apiService.post<{ eventId: string }, object>(`/api/videos/${videoAiDataId}/export`, {
          ...data,
          ...(hasBrandEntitlement && data.brandWatermarkUploadId
            ? {
              brandWatermarkUploadId: data.brandWatermarkUploadId,
              brandWatermarkPosition: data.brandWatermarkPosition
            }
            : {}),
          ...(watch('orientationType') === 'HORIZONTAL' && data.generateThumbnail ? { generateThumbnail: true } : {})
        });
        navigate(`/export-progress/${eventId}`);
      }
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onStartExport)}>
          <ModalContent>
            <ModalHeader>
              <ModalCloseButton />
            </ModalHeader>
            <ModalBody display="flex" flexDir="row" gap={8} py={0}>
              <Flex flexDir="column" w="100%" gap={8}>
                <Heading>Export Settings</Heading>
                <VStack align="stretch" spacing={8} px={0}>
                  {canExportVertical && watch('exportType') !== 'FCPXML' && (
                    <FormControl isInvalid={!!errors.orientationType?.message}>
                      <FormLabel>Orientation</FormLabel>
                      <Controller
                        name="orientationType"
                        render={({ field }) => {
                          return (
                            <HStack spacing={3} justifyContent="stretch">
                              <Button
                                leftIcon={<IoPhoneLandscapeOutline size={20} />}
                                size="sm"
                                w={'100%'}
                                variant={field.value === 'HORIZONTAL' ? 'solid' : 'outline'}
                                onClick={() => field.onChange('HORIZONTAL')}
                                colorScheme={field.value === 'HORIZONTAL' ? 'white' : 'gray'}
                              >
                                Landscape
                              </Button>
                              <Button
                                leftIcon={<IoPhonePortraitOutline size={20} />}
                                size="sm"
                                w={'100%'}
                                variant={field.value === 'VERTICAL' ? 'solid' : 'outline'}
                                onClick={() => field.onChange('VERTICAL')}
                                colorScheme={field.value === 'VERTICAL' ? 'white' : 'gray'}
                              >
                                Portrait
                              </Button>
                            </HStack>
                          );
                        }}
                      />
                      <FormErrorMessage>{errors.orientationType?.message?.toString()}</FormErrorMessage>
                    </FormControl>
                  )}

                  {watch('exportType') !== 'FCPXML' && (
                    <FormControl display="flex" alignItems="center" gap={2}>
                      <FormLabel mb="0">Include captions</FormLabel>
                      <Controller
                        name="exportType"
                        render={({ field }) => {
                          return (
                            <Switch
                              isChecked={field.value === 'VIDEO_CAPTIONS'}
                              onChange={e => field.onChange(e.target.checked ? 'VIDEO_CAPTIONS' : 'VIDEO')}
                            />
                          );
                        }}
                      />
                    </FormControl>
                  )}

                  <HStack spacing={3} w="full" align="center">
                    <Box flex={1} h="1px" bg="gray.600" />
                    <Button
                      leftIcon={<FaCog />}
                      variant="ghost"
                      size="sm"
                      onClick={onAdvancedToggle}
                      colorScheme="gray"
                    >
                      {isAdvancedOpen ? 'Hide' : 'Show'} Advanced Settings
                    </Button>
                    <Box flex={1} h="1px" bg="gray.600" />
                  </HStack>

                  <Collapse in={isAdvancedOpen} animateOpacity>
                    <VStack align="stretch" spacing={4} mt={4} p={4} bg="gray.800" borderRadius="md">
                      <Heading size="md">Advanced Settings</Heading>

                      <FormControl>
                        <Checkbox
                          isChecked={watch('exportType') === 'FCPXML'}
                          onChange={e => setValue('exportType', e.target.checked ? 'FCPXML' : 'VIDEO')}
                        >
                          Export FCPXML for Premiere, FinalCut, Davinci Resolve
                        </Checkbox>
                      </FormControl>

                      {hasBrandEntitlement && (
                        <>
                          <Divider />
                          <Box>
                            <Heading size="sm" display="flex" alignItems="center" gap={2}>
                              Brand Watermark
                              <IconButton
                                icon={<FaPlus />}
                                size="xs"
                                colorScheme="white"
                                aria-label="Add brand asset"
                                variant="outline"
                                onClick={() => navigate('/brand-assets')}
                              />
                            </Heading>
                            <HStack spacing={4} mt={2} align="center">
                              <FormControl maxW="220px">
                                <FormLabel>Position</FormLabel>
                                <Select {...methods.register('brandWatermarkPosition')} defaultValue="top-right">
                                  <option value="top-left">Top Left</option>
                                  <option value="top-right">Top Right</option>
                                  <option value="bottom-left">Bottom Left</option>
                                  <option value="bottom-right">Bottom Right</option>
                                  <option value="center">Center</option>
                                </Select>
                              </FormControl>
                              <FormControl maxW="280px">
                                <FormLabel>Choose Existing</FormLabel>
                                <Select
                                  placeholder={brandAssets.length ? 'Select logo' : 'No brand assets yet'}
                                  {...methods.register('brandWatermarkUploadId')}
                                >
                                  {brandAssets.map(a => (
                                    <option key={a._id} value={a._id}>
                                      {a.name ?? a._id}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>
                            </HStack>
                          </Box>
                        </>
                      )}

                      {/* Generate Thumbnail - Only for horizontal videos */}
                      {watch('orientationType') === 'HORIZONTAL' && (
                        <>
                          <Divider />
                          <FormControl display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                              <FormLabel mb={1}>Generate Thumbnail Automatically</FormLabel>
                              <FormHelperText fontSize="xs">
                                Automatically generate a custom thumbnail using AI based on your video content
                              </FormHelperText>
                            </Box>
                            <Controller
                              name="generateThumbnail"
                              control={methods.control}
                              defaultValue={false}
                              render={({ field }) => (
                                <Switch
                                  colorScheme="blue"
                                  isChecked={field.value || false}
                                  onChange={field.onChange}
                                  size="lg"
                                />
                              )}
                            />
                          </FormControl>
                        </>
                      )}
                    </VStack>
                  </Collapse>
                </VStack>
              </Flex>
            </ModalBody>
            <ModalFooter flexDir="column" alignItems="stretch" gap={3}>
              <Flex justify="flex-end" gap={3}>
                <Button variant="outline" onClick={onClose} type="button">
                  Cancel
                </Button>
                <Button
                  variant="solid"
                  colorScheme="white"
                  isLoading={isLoading}
                  type="submit"
                >
                  Export
                </Button>
              </Flex>
            </ModalFooter>
          </ModalContent>
        </form>
      </FormProvider>
    </Modal>
  );
};
