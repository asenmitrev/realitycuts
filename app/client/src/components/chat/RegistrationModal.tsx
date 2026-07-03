import { FC, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  Input,
  VStack,
  Text,
  useToast,
  Flex,
  Divider,
  InputGroup,
  InputRightElement,
  IconButton
} from '@chakra-ui/react';
import { useAuthUser, useIsAuthInitializing } from '../../contexts/auth/hooks';
import { useAuthService } from '../../contexts/auth/hooks';
import { useApiService } from '../../hooks/useApiService';
import { isErrorWithMessage } from 'shared/helperFunctions';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

const DEFAULT_TITLE = 'Sign up to finalize your video';
const DEFAULT_SUBTITLE =
  'Create an account to save your video and progress.';

export const RegistrationModal: FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const { login, register: doRegister } = useAuthService();
  const apiService = useApiService();
  const user = useAuthUser();
  const authInitializing = useIsAuthInitializing();
  const toast = useToast();

  // If user becomes authenticated, close the modal and navigate
  useState(() => {
    if (user && !authInitializing) {
      handleClose();
    }
  });

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setIsPasswordLoading(true);
    try {
      let result;
      if (authMode === 'register') {
        result = await doRegister(email.trim(), password);
      } else {
        result = await login(email.trim(), password);
      }

      await afterLoginService(result.user.id, result.user.email, result.user.firstName, result.user.lastName);
      handleClose();
    } catch (err: unknown) {
      console.error('Failed to authenticate:', err);
      const description =
        isErrorWithMessage(err)
          ? err.message
          : 'Please check your credentials and try again.';
      toast({
        title: authMode === 'register' ? 'Sign up failed' : 'Sign in failed',
        description,
        status: 'error',
        isClosable: true
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setAuthMode('register');
    onClose();
  };

  const afterLoginService = async (
    firebaseId: string,
    email?: string,
    firstName?: string,
    lastName?: string
  ) => {
    try {
      await apiService.post<
        { message: string },
        { firebaseId: string; email?: string; firstName?: string; lastName?: string }
      >('/api/afterlogin', {
        firebaseId,
        email,
        firstName,
        lastName
      });
    } catch (error) {
      console.error('Error with after login:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch">
            <Text color="whiteAlpha.700">{subtitle}</Text>
            <form onSubmit={handlePasswordSubmit}>
              <VStack spacing={3} align="stretch">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  isRequired
                  bg="whiteAlpha.100"
                  borderColor="whiteAlpha.300"
                  _placeholder={{ color: 'whiteAlpha.500' }}
                />
                <InputGroup>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    isRequired
                    bg="whiteAlpha.100"
                    borderColor="whiteAlpha.300"
                    _placeholder={{ color: 'whiteAlpha.500' }}
                    pr="2.5rem"
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                      size="sm"
                      variant="ghost"
                      color="whiteAlpha.600"
                      _hover={{ color: 'white' }}
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    />
                  </InputRightElement>
                </InputGroup>
                <Button type="submit" colorScheme="teal" w="100%" isLoading={isPasswordLoading}>
                  {authMode === 'register' ? 'Sign up' : 'Sign in'}
                </Button>
              </VStack>
            </form>
            <Flex align="center" gap={3} w="100%">
              <Divider borderColor="whiteAlpha.300" />
              <Text color="whiteAlpha.600" fontSize="sm">
                or
              </Text>
              <Divider borderColor="whiteAlpha.300" />
            </Flex>
            <Text
              fontSize="sm"
              color="whiteAlpha.600"
              textAlign="center"
              cursor="pointer"
              _hover={{ color: 'whiteAlpha.900' }}
              onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}
            >
              {authMode === 'register' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </Text>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
