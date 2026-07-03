import { FC } from 'react';
import {
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Heading,
  useColorModeValue
} from '@chakra-ui/react';
import { UseFormRegister, useFormContext } from 'react-hook-form';
import { LibraryChoice } from '../upload/LibraryChoice';
import { AutomationConfigFormData, UploadFormData, IAutomationConfig } from '../../types';

interface LibrarySelectionProps {
  existingConfig?: IAutomationConfig;
}

export const LibrarySelection: FC<LibrarySelectionProps> = ({ existingConfig }) => {
  const { register, watch } = useFormContext<AutomationConfigFormData>();

  const bgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const textColor = useColorModeValue('white', 'white');

  return (
    <AccordionItem
      borderTop="4px solid"
      borderTopColor="cyan.400"
      borderLeft="1px solid"
      borderRight="1px solid"
      borderBottom="1px solid"
      borderLeftColor={borderColor}
      borderRightColor={borderColor}
      borderBottomColor={borderColor}
      borderRadius="lg"
      mb={4}
      bg={bgColor}
    >
      <AccordionButton py={4}>
        <Box flex="1" textAlign="left">
          <Heading as="h2" size="md" color={textColor}>
            Source Libraries
          </Heading>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4}>
        <LibraryChoice
          register={register as unknown as UseFormRegister<UploadFormData>} // TODO: fix this
          uploadType="script"
          script={watch('contentSettings.theme') ?? ''}
          publicLibraryIds={existingConfig?.contentSettings?.publicLibraryIds}
          privateLibraryIds={existingConfig?.contentSettings?.privateLibraryIds}
        />
      </AccordionPanel>
    </AccordionItem>
  );
};
