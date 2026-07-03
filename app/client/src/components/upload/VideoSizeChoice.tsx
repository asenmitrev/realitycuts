import { FC } from 'react';
import { Box, Text, Radio, HStack } from '@chakra-ui/react';

export const VideoSizeChoice: FC<{ value: string; label: string; isSelected: boolean }> = ({
  value,
  label,
  isSelected
}) => {
  return (
    <Box
      borderRadius="xl"
      w={{ md: 'calc(33% - 9px)', base: '100%', sm: 'calc(50% - 8px)' }}
      bg={'whiteAlpha.100'}
      borderWidth="1px"
      borderColor={isSelected ? 'blue.400' : 'whiteAlpha.200'}
      transition="all 0.2s"
      _hover={{
        borderColor: 'blue.400',
        transform: 'translateY(-2px)',
        shadow: 'lg'
      }}
      cursor="pointer"
    >
      <Radio
        p={4}
        colorScheme="blue"
        display="flex"
        alignItems="center"
        justifyContent="stretch"
        value={value}
        size="sm"
      >
        <HStack spacing={4} flexGrow={1} justify="space-between" w="100%">
          <Text
            fontSize="md"
            textTransform="capitalize"
            fontWeight="medium"
            color={isSelected ? 'white' : 'whiteAlpha.900'}
          >
            {label}
          </Text>
        </HStack>
      </Radio>
    </Box>
  );
};
