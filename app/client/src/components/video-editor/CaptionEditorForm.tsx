import { FC } from 'react';
import {
  FormControl,
  FormLabel,
  Input,
  Radio,
  RadioGroup,
  Stack,
  Select,
  Switch,
  SimpleGrid,
  VStack,
  Text,
  Icon,
  useColorModeValue,
  HStack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs
} from '@chakra-ui/react';
import { Controller, useFormContext } from 'react-hook-form';
import { ColorInput } from './ColorInput';
import { FaFont, FaPalette, FaSliders } from 'react-icons/fa6';

const fontOptions = [
  { value: 'Roboto Medium', label: 'Roboto' },
  { value: 'Poppins Medium', label: 'Poppins' },
  { value: 'Montserrat-Bold', label: 'Montserrat' },
  { value: 'Fira Sans Condensed ExtraBold Italic', label: 'Fira Sans Condensed' },
  { value: 'Lobster', label: 'Lobster' }
];

interface CaptionEditorFormProps {
  fieldPrefix?: string; // For nested form fields like "contentSettings.captionPreset"
}

export const CaptionEditorForm: FC<CaptionEditorFormProps> = ({ fieldPrefix = '' }) => {
  const { register, watch, setValue, control } = useFormContext();

  const borderColor = useColorModeValue('#555', '#555');
  const textColor = useColorModeValue('white', 'white');

  // Helper to create field names with prefix
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getFieldName = (field: string): any => (fieldPrefix ? `${fieldPrefix}.${field}` : field);

  const captionType = watch(getFieldName('type'));
  const marginV = watch(getFieldName('marginV'));

  // Derive position from marginV
  const currentPosition = marginV > 60 ? 'top' : marginV > 30 ? 'center' : 'bottom';
  return (
    <Tabs colorScheme="teal" isFitted>
      <TabList>
        <Tab>
          <HStack spacing={2}>
            <Icon as={FaSliders} />
            <Text>Style</Text>
          </HStack>
        </Tab>
        <Tab>
          <HStack spacing={2}>
            <Icon as={FaFont} />
            <Text>Typography</Text>
          </HStack>
        </Tab>
        <Tab>
          <HStack spacing={2}>
            <Icon as={FaPalette} />
            <Text>Colors</Text>
          </HStack>
        </Tab>
      </TabList>

      <TabPanels>
        {/* Style Tab */}
        <TabPanel>
          <VStack spacing={6} align="stretch">
            <FormControl>
              <FormLabel fontWeight="bold" color={textColor}>
                Subtitle Style
              </FormLabel>
              <Controller
                name={getFieldName('type')}
                control={control}
                render={({ field }) => (
                  <RadioGroup onChange={field.onChange} value={field.value} colorScheme="teal">
                    <Stack direction="column" spacing={4}>
                      <Radio value="WORD_APPEAR" size="lg">
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold" color={textColor}>
                            Pop-up
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            Words appear one by one
                          </Text>
                        </VStack>
                      </Radio>
                      <Radio value="WORD_HIGHLIGHT" size="lg">
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold" color={textColor}>
                            Highlight
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            Words are highlighted as they're spoken
                          </Text>
                        </VStack>
                      </Radio>
                      <Radio value="WORD_BACKGROUND" size="lg">
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold" color={textColor}>
                            Box
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            Words have background boxes
                          </Text>
                        </VStack>
                      </Radio>
                    </Stack>
                  </RadioGroup>
                )}
              />
            </FormControl>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <FormControl>
                <FormLabel fontWeight="bold" color={textColor}>
                  Positioning
                </FormLabel>
                <Controller
                  name={getFieldName('position')}
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      value={currentPosition}
                      onChange={e => {
                        const newPosition = e.target.value;
                        const marginV = newPosition === 'top' ? 75 : newPosition === 'center' ? 44 : 15;
                        setValue(getFieldName('marginV'), marginV);
                        setValue(getFieldName('position'), newPosition);
                        field.onChange(e);
                      }}
                      borderColor={borderColor}
                      color={textColor}
                    >
                      <option value="top">Top</option>
                      <option value="center">Center</option>
                      <option value="bottom">Bottom</option>
                    </Select>
                  )}
                />
              </FormControl>
            </SimpleGrid>
          </VStack>
        </TabPanel>

        {/* Typography Tab */}
        <TabPanel>
          <VStack spacing={6} align="stretch">
            <FormControl>
              <FormLabel fontWeight="bold" color={textColor}>
                Font Family
              </FormLabel>
              <Controller
                name={getFieldName('fontFamily')}
                control={control}
                render={({ field }) => (
                  <Select {...field} placeholder="Select font family..." borderColor={borderColor} color={textColor}>
                    {fontOptions.map(font => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                  </Select>
                )}
              />
            </FormControl>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <FormControl>
                <FormLabel fontWeight="bold" color={textColor}>
                  Font Size (px)
                </FormLabel>
                <Input
                  {...register(getFieldName('fontSize'), {
                    valueAsNumber: true,
                    onChange: e => {
                      setValue(
                        getFieldName('verticalFontSize'),
                        Math.round((Number.parseFloat(e.target.value) * 4) / 3)
                      );
                    }
                  })}
                  type="number"
                  borderColor={borderColor}
                  color={textColor}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontWeight="bold" color={textColor}>
                  Active Word Font Size (px)
                </FormLabel>
                <Input
                  {...register(getFieldName('activeWordFontSize'), {
                    valueAsNumber: true,
                    onChange: e => {
                      setValue(
                        getFieldName('verticalActiveWordFontSize'),
                        Math.round((Number.parseFloat(e.target.value) * 4) / 3)
                      );
                    }
                  })}
                  type="number"
                  borderColor={borderColor}
                  color={textColor}
                />
              </FormControl>
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <FormControl>
                <FormLabel fontWeight="bold" color={textColor}>
                  Outline Width (px)
                </FormLabel>
                <Input
                  {...register(getFieldName('outlineWidth'), {
                    valueAsNumber: true
                  })}
                  type="number"
                  borderColor={borderColor}
                  color={textColor}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontWeight="bold" color={textColor}>
                  Shadow
                </FormLabel>
                <Input
                  {...register(getFieldName('shadow'), {
                    valueAsNumber: true
                  })}
                  type="number"
                  borderColor={borderColor}
                  color={textColor}
                />
              </FormControl>
            </SimpleGrid>

            <FormControl
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              p={3}
              borderWidth="1px"
              borderRadius="md"
              borderColor={borderColor}
            >
              <FormLabel fontWeight="bold" mb={0} color={textColor}>
                Uppercase
              </FormLabel>
              <Controller
                name={getFieldName('isUppercase')}
                control={control}
                render={({ field: { value, onChange } }) => (
                  <Switch isChecked={value} onChange={onChange} colorScheme="teal" size="lg" />
                )}
              />
            </FormControl>
          </VStack>
        </TabPanel>

        {/* Colors Tab */}
        <TabPanel>
          <VStack spacing={6} align="stretch">
            <FormControl display="flex" flexDirection="row" justifyContent="space-between" alignItems="center">
              <FormLabel fontWeight="bold" color={textColor} mb={0}>
                Primary Text Fill Color
              </FormLabel>
              <ColorInput name={getFieldName('primaryColor')} />
            </FormControl>

            {captionType !== 'WORD_APPEAR' && (
              <FormControl display="flex" flexDirection="row" justifyContent="space-between" alignItems="center">
                <FormLabel fontWeight="bold" color={textColor} mb={0}>
                  Active Word Fill Color
                </FormLabel>
                <ColorInput name={getFieldName('highlightedWordColor')} />
              </FormControl>
            )}

            <FormControl display="flex" flexDirection="row" justifyContent="space-between" alignItems="center">
              <FormLabel fontWeight="bold" color={textColor} mb={0}>
                Outline Color
              </FormLabel>
              <ColorInput name={getFieldName('outlineColor')} />
            </FormControl>

            {captionType === 'WORD_BACKGROUND' && (
              <FormControl display="flex" flexDirection="row" justifyContent="space-between" alignItems="center">
                <FormLabel fontWeight="bold" color={textColor} mb={0}>
                  Active Word Background Color
                </FormLabel>
                <ColorInput name={getFieldName('backgroundColor')} />
              </FormControl>
            )}
          </VStack>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};
