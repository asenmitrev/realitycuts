import { FC } from 'react';
import { Box, Flex, Icon, Text } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { HiSparkles } from 'react-icons/hi2';

const bounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
`;

interface LoadingIndicatorProps {
  status?: string | null;
}

export const LoadingIndicator: FC<LoadingIndicatorProps> = ({ status }) => {
  console.log('[LoadingIndicator] status prop:', status);
  return (
    <Flex w="100%" justify="flex-start" mb={4}>
      <Flex maxW={{ base: '95%', md: '80%', lg: '70%' }} align="flex-start" gap={3}>
        {/* Avatar */}
        <Flex
          w="36px"
          h="36px"
          borderRadius="10px"
          bg="linear-gradient(135deg, #22D0FF 0%, #0097ff 100%)"
          align="center"
          justify="center"
          flexShrink={0}
          animation={`${pulse} 2s ease-in-out infinite`}
        >
          <Icon as={HiSparkles} boxSize={4} color="white" />
        </Flex>

        {/* Loading bubble */}
        <Box
          bg="whiteAlpha.50"
          border="1px solid"
          borderColor="whiteAlpha.100"
          px={5}
          py={4}
          borderRadius="16px"
          borderTopLeftRadius="4px"
        >
          <Flex gap={3} align="center" minH="20px">
            {/* Status text */}
            {status && (
              <Text
                color="whiteAlpha.700"
                fontSize="sm"
                fontWeight="500"
                animation={`${fadeIn} 0.3s ease-out`}
                key={status} // Re-trigger animation on status change
              >
                {status}
              </Text>
            )}
            {/* Bouncing dots */}
            <Flex gap={1.5} align="center">
              {[0, 1, 2].map(i => (
                <Box
                  key={i}
                  w="6px"
                  h="6px"
                  bg="teal.200"
                  borderRadius="full"
                  animation={`${bounce} 1.4s ease-in-out infinite`}
                  style={{ animationDelay: `${i * 0.16}s` }}
                />
              ))}
            </Flex>
          </Flex>
        </Box>
      </Flex>
    </Flex>
  );
};
