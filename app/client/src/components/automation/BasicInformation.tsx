import { FC, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Heading,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Select,
  IconButton,
  useColorModeValue,
  Textarea,
  FormHelperText,
  Switch
} from '@chakra-ui/react';
import { Controller, useFormContext } from 'react-hook-form';
import { FaPlus } from 'react-icons/fa';
import { AutomationConfigFormData } from '../../types';

interface BasicInformationProps {
  hasBrandEntitlement: boolean;
  brandAssets: { _id: string; name?: string; s3UploadId: { url: string } }[];
}

export const BasicInformation: FC<BasicInformationProps> = ({ hasBrandEntitlement, brandAssets }) => {
  const { watch, setValue } = useFormContext<AutomationConfigFormData>();
  const navigate = useNavigate();
  const { register, control } = useFormContext<AutomationConfigFormData>();

  const bgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const textColor = useColorModeValue('white', 'white');

  const orientation = watch('contentSettings.orientation');

  // Disable generateThumbnail when orientation changes to vertical
  useEffect(() => {
    if (orientation === 'vertical' && watch('contentSettings.generateThumbnail')) {
      setValue('contentSettings.generateThumbnail', true, { shouldDirty: true });
    }
  }, [orientation, setValue, watch]);

  return (
    <AccordionItem
      borderTop="4px solid"
      borderTopColor="yellow.400"
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
            Advanced Settings
          </Heading>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4}>
        <VStack spacing={6} align="stretch">
          {hasBrandEntitlement && (
            <Box mt={6}>
              <Heading as="h3" size="sm" color={textColor} mb={2} display="flex" alignItems="center" gap={2}>
                Brand Watermark
                {hasBrandEntitlement && (
                  <IconButton
                    icon={<FaPlus />}
                    size="xs"
                    colorScheme="white"
                    aria-label="Add brand asset"
                    variant="outline"
                    onClick={() => navigate('/brand-assets')}
                  />
                )}
              </Heading>
              <HStack spacing={4} align="center">
                <FormControl maxW="220px">
                  <FormLabel>Position</FormLabel>
                  <Select
                    value={watch('contentSettings.brandWatermarkPosition') ?? 'top-right'}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setValue(
                        'contentSettings.brandWatermarkPosition',
                        e.target.value as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center',
                        { shouldDirty: true }
                      )
                    }
                  >
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
                    value={watch('contentSettings.brandWatermarkUploadId') ?? ''}
                    onChange={e => {
                      setValue('contentSettings.brandWatermarkUploadId', e.target.value, {
                        shouldDirty: true
                      });
                      // Set default position if not already set
                      if (!watch('contentSettings.brandWatermarkPosition')) {
                        setValue('contentSettings.brandWatermarkPosition', 'top-right', {
                          shouldDirty: true
                        });
                      }
                    }}
                  >
                    {brandAssets.map((a: { _id: string; name?: string }) => (
                      <option key={a._id} value={a._id}>
                        {a.name ?? a._id}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </HStack>
            </Box>
          )}

          {/* Hashtags */}
          <FormControl>
            <FormLabel color={textColor}>Hashtags</FormLabel>
            <Textarea
              {...register('contentSettings.hashtags')}
              placeholder="Enter hashtags to be added to video descriptions (e.g., #tech #ai #shorts #viral)"
              rows={2}
              bg="whiteAlpha.100"
              borderColor="whiteAlpha.200"
              _hover={{ borderColor: 'blue.400' }}
              _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
            />
            <FormHelperText>
              These hashtags will be automatically appended to the generated video descriptions
            </FormHelperText>
          </FormControl>

          {/* Music Generation */}
          <FormControl>
            <HStack justify="space-between" align="center">
              <Box>
                <FormLabel color={textColor} mb={1}>
                  Include Background Music
                </FormLabel>
                <FormHelperText>Automatically generate and include background music in your videos</FormHelperText>
              </Box>
              <Controller
                name="contentSettings.includeMusic"
                control={control}
                render={({ field }) => (
                  <Switch colorScheme="blue" isChecked={field.value || false} onChange={field.onChange} size="lg" />
                )}
              />
            </HStack>
          </FormControl>
          {/* Music Prompt Override */}
          {watch('contentSettings.includeMusic') && (
            <FormControl>
              <FormLabel color={textColor}>Music Style (Optional)</FormLabel>
              <Textarea
                {...register('contentSettings.musicPrompt')}
                placeholder="Describe the style of music you want (e.g., 'Upbeat electronic music with driving beats', 'Gentle acoustic guitar with soft piano melodies'). Leave empty for AI to choose automatically based on content."
                rows={3}
                bg="whiteAlpha.100"
                borderColor="whiteAlpha.200"
                _hover={{ borderColor: 'blue.400' }}
                _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
              />
              <FormHelperText>
                Override the automatic music selection with your custom style description. Our AI will generate music
                matching your specifications.
              </FormHelperText>
            </FormControl>
          )}

          {/* Generate Thumbnail - Only for horizontal videos */}
          {watch('contentSettings.orientation') === 'horizontal' && watch('contentSettings.generateThumbnail') === false && (
            <FormControl>
              <HStack justify="space-between" align="center">
                <Box>
                  <FormLabel color={textColor} mb={1}>
                    Generate Thumbnail Automatically
                  </FormLabel>
                  <FormHelperText>
                    Automatically generate a custom thumbnail using AI based on your video content
                  </FormHelperText>
                </Box>
                <Controller
                  name="contentSettings.generateThumbnail"
                  control={control}
                  render={({ field }) => (
                    <Switch colorScheme="blue" isChecked={field.value || false} onChange={field.onChange} size="lg" />
                  )}
                />
              </HStack>
            </FormControl>
          )}
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};
