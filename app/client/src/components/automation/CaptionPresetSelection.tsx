import { FC, useState } from 'react';
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
  FormErrorMessage,
  Button,
  SimpleGrid,
  useColorModeValue,
  Switch,
  HStack
} from '@chakra-ui/react';
import { Controller, useFormContext } from 'react-hook-form';
import { AutomationConfigFormData, CaptionSettings } from '../../types';
import { CAPTION_PRESETS } from 'shared/config/captions';
import preset1Image from '../../assets/captions/preset-1.png';
import preset2Image from '../../assets/captions/preset-2.png';
import preset3Image from '../../assets/captions/preset-3.png';
import preset4Image from '../../assets/captions/preset-4.png';
import preset5Image from '../../assets/captions/preset-5.png';
import preset6Image from '../../assets/captions/preset-6.png';
import _ from 'lodash';
import { CaptionEditorForm } from '../video-editor/CaptionEditorForm';
import { FaPencil } from 'react-icons/fa6';

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
  onSelect
}: {
  preset: CaptionSettings;
  isActive: boolean;
  onSelect: (preset: CaptionSettings) => void;
}) => {
  const presetImage = presetImages[preset.name ?? ''];

  return (
    <Button
      key={preset._id || preset.name}
      as="div"
      cursor="pointer"
      variant={isActive ? 'solid' : 'outline'}
      colorScheme={isActive ? 'blue' : 'gray'}
      justifyContent={presetImage ? 'center' : 'space-between'}
      size="lg"
      onClick={() => onSelect(preset)}
      w="100%"
    >
      {presetImage ? <Box as="img" src={presetImage} alt={preset.name} maxH="40px" objectFit="contain" /> : preset.name}
    </Button>
  );
};

export const CaptionPresetSelection: FC = () => {
  const {
    control,
    formState: { errors },
    watch
  } = useFormContext<AutomationConfigFormData>();

  const [isCustomizing, setIsCustomizing] = useState(false);

  const bgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const textColor = useColorModeValue('white', 'white');

  const selectedCaption = watch('contentSettings.captionPreset');

  return (
    <AccordionItem
      borderTop="4px solid"
      borderTopColor="green.400"
      borderLeft="1px solid"
      borderRight="1px solid"
      borderBottom="1px solid"
      borderLeftColor={borderColor}
      borderRightColor={borderColor}
      mb={4}
      borderBottomColor={borderColor}
      borderRadius="lg"
      bg={bgColor}
    >
      <AccordionButton py={4}>
        <Box flex="1" textAlign="left">
          <Heading as="h2" size="md" color={textColor}>
            Caption Settings
          </Heading>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4}>
        <VStack spacing={6} align="stretch">
          <FormControl isInvalid={!!errors.contentSettings?.captionPreset?.message} isRequired>
            <FormLabel color={textColor}>Caption Preset</FormLabel>
            <Controller
              name="contentSettings.captionPreset"
              control={control}
              render={({ field }) => (
                <SimpleGrid columns={2} spacing={4}>
                  {CAPTION_PRESETS.map(preset => {
                    const isActive = field.value ? _.isEqual(field.value, preset) : false;
                    return (
                      <CaptionPreset
                        key={preset._id || preset.name}
                        preset={preset}
                        isActive={isActive}
                        onSelect={() => field.onChange(preset)}
                      />
                    );
                  })}
                </SimpleGrid>
              )}
            />
            <FormErrorMessage>{errors.contentSettings?.captionPreset?.message?.toString()}</FormErrorMessage>
          </FormControl>

          {selectedCaption && (
            <>
              {/* Customization Toggle */}
              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <HStack spacing={2}>
                  <FaPencil color={textColor} />
                  <FormLabel htmlFor="customize-captions" mb="0" color={textColor} fontWeight="semibold">
                    Customize Caption Style
                  </FormLabel>
                </HStack>
                <Switch
                  id="customize-captions"
                  colorScheme="teal"
                  isChecked={isCustomizing}
                  onChange={e => setIsCustomizing(e.target.checked)}
                />
              </FormControl>

              {/* Caption Customizer */}
              {isCustomizing && (
                <Box p={4}>
                  <CaptionEditorForm fieldPrefix="contentSettings.captionPreset" />
                </Box>
              )}
            </>
          )}
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};
