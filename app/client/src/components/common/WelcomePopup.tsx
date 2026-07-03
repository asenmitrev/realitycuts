import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Text,
  VStack
} from '@chakra-ui/react';
import { FaCheck } from 'react-icons/fa';

export const WelcomePopup: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const hasOpened = localStorage.getItem('welcomePopup') === 'true';

  const handleClose = () => {
    localStorage.setItem('welcomePopup', 'true');
    onClose();
  };
  return (
    <Modal isOpen={!hasOpened && isOpen} onClose={handleClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton zIndex={1000} />
        <Card maxW="2xl" mx="auto" color="white" borderRadius={0} border="none">
          <CardHeader>
            <Heading as="h2" size="xl" textAlign="center" mb={2}>
              🎉 Welcome to RealityCuts! 🎉
            </Heading>
            <Text textAlign="center" color="gray.300">
              Here&apos;s everything you can explore:
            </Text>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Flex align="center" gap={3}>
                <Box as={FaCheck} boxSize={6} color="blue.400" />
                <Text>Personal Libraries: upload and manage your own video footage</Text>
              </Flex>
              <Flex align="center" gap={3}>
                <Box as={FaCheck} boxSize={6} color="blue.400" />
                <Text>Video Generation: create videos from prompts using AI</Text>
              </Flex>
              <Flex align="center" gap={3}>
                <Box as={FaCheck} boxSize={6} color="blue.400" />
                <Text>Editing: fine-tune your videos in the canvas-based editor</Text>
              </Flex>
            </VStack>
          </CardBody>
        </Card>
      </ModalContent>
    </Modal>
  );
};
