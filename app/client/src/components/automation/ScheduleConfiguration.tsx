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
import { ScheduleSelector } from './ScheduleSelector';

export interface AutomationLimits {
  current: {
    daily: number;
    weekly: number;
  };
  limits: {
    daily: number;
    weekly: number;
  };
  canCreateDaily: boolean;
  canCreateWeekly: boolean;
}

interface ScheduleConfigurationProps {
  automationLimits: AutomationLimits | undefined;
  isLoadingLimits: boolean;
  isEdit: boolean;
}

export const ScheduleConfiguration: FC<ScheduleConfigurationProps> = ({ automationLimits, isEdit }) => {
  const bgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const textColor = useColorModeValue('white', 'white');

  return (
    <AccordionItem
      borderTop="4px solid"
      borderTopColor="orange.400"
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
            Schedule Configuration
          </Heading>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4}>
        <ScheduleSelector
          canCreateDaily={isEdit || (automationLimits?.canCreateDaily ?? true)}
          canCreateWeekly={isEdit || (automationLimits?.canCreateWeekly ?? true)}
          isEdit={isEdit}
        />
      </AccordionPanel>
    </AccordionItem>
  );
};
