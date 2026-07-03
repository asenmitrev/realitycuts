import { Box, Button, Container, Grid, Heading, Text, VStack, HStack, useColorModeValue } from '@chakra-ui/react';

import { Link } from 'react-router-dom';
import { FC } from 'react';
import { FaFolder, FaVideo } from 'react-icons/fa';

export const WelcomeDashboard: FC = () => {
  const cardBgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const textColor = useColorModeValue('white', 'white');
  const mutedTextColor = useColorModeValue('gray.400', 'gray.400');
  return (
    <Box minH="100vh" color={textColor}>
      <Container maxW="7xl" py={12}>
        <VStack spacing={12} align="stretch">
          <Box>
            <Heading as="h1" size="2xl" mb={4}>
              Welcome to RealityCuts
            </Heading>
            <Text fontSize="xl" color={mutedTextColor}>
              Let's help you get started with your video editing journey
            </Text>
          </Box>

          <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={8}>
            <VStack spacing={8} align="stretch">
              <Box bg={cardBgColor} borderRadius="md" p={6} borderWidth={1} borderColor="whiteAlpha.200">
                <Heading as="h2" size="lg" mb={4}>
                  Quick Actions
                </Heading>
                <VStack spacing={4}>
                  <Button
                    variant="outline"
                    as={Link}
                    to="/library/add"
                    justifyContent="flex-start"
                    height="auto"
                    p={4}
                    width="full"
                  >
                    <HStack spacing={4}>
                      <Box bg="blue.900" p={3} borderRadius="full">
                        <FaFolder size={24} color="blue.200" />
                      </Box>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="semibold" fontSize="lg">
                          Create Library
                        </Text>
                        <Text fontSize="sm" color={mutedTextColor}>
                          Organize your video assets in one place
                        </Text>
                      </VStack>
                    </HStack>
                  </Button>
                  <Button
                    variant="outline"
                    as={Link}
                    to="/upload?type=script"
                    justifyContent="flex-start"
                    height="auto"
                    p={4}
                    width="full"
                  >
                    <HStack spacing={4}>
                      <Box bg="blue.900" p={3} borderRadius="full">
                        <FaVideo size={24} color="blue.200" />
                      </Box>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="semibold" fontSize="lg">
                          New Project
                        </Text>
                        <Text fontSize="sm" color={mutedTextColor}>
                          Start editing your first video
                        </Text>
                      </VStack>
                    </HStack>
                  </Button>

                </VStack>
              </Box>

              <Box bg={cardBgColor} borderRadius="md" p={6} borderWidth={1} borderColor="whiteAlpha.200">
                <Heading as="h2" size="lg" mb={4}>
                  Getting Started Guide
                </Heading>
                <VStack spacing={4} align="stretch">
                  <HStack spacing={4}>
                    <Box bg="blue.900" p={2} borderRadius="full">
                      <Text fontWeight="bold" color="whiteAlpha.800">
                        1
                      </Text>
                    </Box>
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="medium">Create a Library</Text>
                      <Text fontSize="sm" color={mutedTextColor}>
                        Upload and organize your video assets
                      </Text>
                    </VStack>
                  </HStack>
                  <HStack spacing={4}>
                    <Box bg="blue.900" p={2} borderRadius="full">
                      <Text fontWeight="bold" color="whiteAlpha.800">
                        2
                      </Text>
                    </Box>
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="medium">Start a Project</Text>
                      <Text fontSize="sm" color={mutedTextColor}>
                        Choose where to source your assets and begin editing
                      </Text>
                    </VStack>
                  </HStack>
                  <HStack spacing={4}>
                    <Box bg="blue.900" p={2} borderRadius="full">
                      <Text fontWeight="bold" color="whiteAlpha.800">
                        3
                      </Text>
                    </Box>
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="medium">Export Your Video</Text>
                      <Text fontSize="sm" color={mutedTextColor}>
                        Generate and download your finished project
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              </Box>
            </VStack>

          </Grid>
        </VStack>
      </Container>
    </Box>
  );
};
