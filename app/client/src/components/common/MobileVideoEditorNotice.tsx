import { Box, VStack, Heading, Text, useColorModeValue } from '@chakra-ui/react';
import { FiSmartphone } from 'react-icons/fi';
import { HEADER_HEIGHT } from '../../const';

export const MobileVideoEditorNotice = () => {
  // Since it's always dark mode, we'll use dark mode colors
  const bgGradient = useColorModeValue('black', 'black');
  const cardBg = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const textColor = useColorModeValue('gray.100', 'gray.100');
  const iconBg = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const iconColor = useColorModeValue('yellow.200', 'yellow.200');

  return (
    <Box
      minHeight={`calc(100vh - ${HEADER_HEIGHT}px)`}
      bgGradient={bgGradient}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box maxWidth="md" width="full" bg={cardBg} borderRadius="lg" boxShadow="xl" p={6}>
        <VStack spacing={6}>
          <Box bg={iconBg} borderRadius="full" p={4} display="flex" alignItems="center" justifyContent="center">
            <FiSmartphone size="40px" color={iconColor} />
          </Box>
          <Heading as="h2" size="xl" textAlign="center" color={textColor}>
            Desktop Only App
          </Heading>
          <Text textAlign="center" color={textColor}>
            We're sorry, but our app is currently only available on desktop devices.
          </Text>
          <Text fontSize="sm" textAlign="center" color="gray.400">
            For the best experience, please visit us on your computer.
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};
