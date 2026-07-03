import {
  Button,
  Container,
  FormControl,
  FormErrorMessage,
  Input,
  Stack,
  Text,
  Heading,
  Box,
  Flex,
  Link as ChakraLink,
  useToast,
  Icon,
  VStack,
  Checkbox
} from '@chakra-ui/react';
import { FC, useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthUser, useIsAuthInitializing } from '../../contexts/auth/hooks';
import { useAuthService } from '../../contexts/auth/hooks';
import { useApiService } from '../../hooks/useApiService';
import { isErrorWithMessage } from 'shared/helperFunctions';
import { FiPlay, FiCheck } from 'react-icons/fi';
import { keyframes } from '@emotion/react';
import { isDisposableEmail } from './utils';

interface AuthFormData {
  email: string;
  password: string;
  acceptTerms: boolean;
}

export const Login: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect');
  const promptToken = params.get('prompt_token');
  const [isLoading, setIsLoading] = useState(false);
  const [promptText, setPromptText] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const { login, register: doRegister } = useAuthService();
  const user = useAuthUser();
  const authInitializing = useIsAuthInitializing();
  const apiService = useApiService();

  const getRedirectUrl = useCallback(() => {
    if (promptToken) {
      return `/preuser-prompt?prompt_token=${promptToken}`;
    }
    return redirect || '/';
  }, [promptToken, redirect]);

  const {
    handleSubmit,
    register,
    control,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<AuthFormData>({ defaultValues: { acceptTerms: true } });
  const toast = useToast();

  useEffect(() => {
    if (user && !authInitializing) {
      navigate(getRedirectUrl());
    }
  }, [user, authInitializing, navigate, getRedirectUrl]);

  useEffect(() => {
    if (!promptToken) return;
    fetch(`/api/preuser-prompts/${promptToken}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { prompt: string } | null) => {
        if (data?.prompt) setPromptText(data.prompt);
      })
      .catch(() => {});
  }, [promptToken]);

  const afterLoginService = async (userId: string, email?: string, firstName?: string, lastName?: string) => {
    try {
      await apiService.post<
        { message: string },
        { firebaseId: string; email?: string; firstName?: string; lastName?: string }
      >('/api/afterlogin', {
        firebaseId: userId,
        email,
        firstName,
        lastName
      });
    } catch (error) {
      console.error('Error with after login:', error);
    }
  };

  const onSubmit = async ({ email, password }: AuthFormData) => {
    setIsLoading(true);
    try {
      let result;
      if (mode === 'register') {
        result = await doRegister(email, password);
      } else {
        result = await login(email, password);
      }

      await afterLoginService(result.user.id, result.user.email, result.user.firstName, result.user.lastName);
      navigate(getRedirectUrl());
    } catch (e: unknown) {
      if (isErrorWithMessage(e)) {
        toast({
          status: 'error',
          description: e.message || `Error ${mode === 'register' ? 'signing up' : 'signing in'}.`
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box minH="100vh" py={12} px={4} display="flex" alignItems="center" justifyContent="center">
      <Flex
        direction={{ base: 'column', lg: 'row' }}
        gap={8}
        maxW={promptToken ? '1200px' : 'md'}
        w="full"
        align="center"
      >
        {promptToken && (
          <Box flex="1" order={{ base: 2, lg: 1 }} maxW={{ base: 'full', lg: '480px' }}>
            <VStack spacing={8} align="stretch">
              <Box
                bg="whiteAlpha.50"
                border="1px solid"
                borderColor="whiteAlpha.200"
                borderRadius="xl"
                overflow="hidden"
                position="relative"
              >
                <Flex
                  bg="whiteAlpha.100"
                  px={4}
                  py={3}
                  align="center"
                  gap={2}
                  borderBottom="1px solid"
                  borderColor="whiteAlpha.100"
                >
                  <Box w="10px" h="10px" borderRadius="full" bg="red.400" opacity={0.8} />
                  <Box w="10px" h="10px" borderRadius="full" bg="yellow.400" opacity={0.8} />
                  <Box w="10px" h="10px" borderRadius="full" bg="green.400" opacity={0.8} />
                  <Text fontSize="xs" color="gray.500" ml={3} fontFamily="mono">
                    your-video.mp4
                  </Text>
                </Flex>

                <Box
                  h={{ base: '180px', md: '220px' }}
                  position="relative"
                  bg="linear-gradient(145deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Box
                    position="absolute"
                    inset={0}
                    opacity={0.03}
                    backgroundImage="repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)"
                  />

                  <Box
                    as="button"
                    w="72px"
                    h="72px"
                    borderRadius="full"
                    bg="white"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    position="relative"
                    cursor="default"
                    _before={{
                      content: '""',
                      position: 'absolute',
                      inset: '-8px',
                      borderRadius: 'full',
                      border: '2px solid',
                      borderColor: 'whiteAlpha.300',
                      animation: `${keyframes`
                        0% { transform: scale(1); opacity: 0.5; }
                        100% { transform: scale(1.4); opacity: 0; }
                      `} 2s ease-out infinite`
                    }}
                  >
                    <Icon as={FiPlay} boxSize={7} color="black" ml={1} />
                  </Box>

                  <Box position="absolute" bottom={0} left={0} right={0} h="3px" bg="whiteAlpha.200">
                    <Box h="full" w="0%" bg="white" borderRadius="full" />
                  </Box>
                </Box>
              </Box>

              <VStack spacing={4} align="stretch" px={2}>
                <Heading fontSize={{ base: 'xl', md: '2xl' }} fontWeight="semibold" color="white" lineHeight="1.3">
                  Sign up to get your video
                </Heading>

                {promptText && (
                  <Box
                    px={4}
                    py={3}
                    bg="whiteAlpha.100"
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                  >
                    <Text fontSize="xs" color="gray.500" mb={1} textTransform="uppercase" letterSpacing="wide">
                      Your prompt
                    </Text>
                    <Text fontSize="sm" color="gray.200" lineHeight="1.6" noOfLines={3}>
                      {promptText}
                    </Text>
                  </Box>
                )}

                <Text fontSize="md" color="gray.400" lineHeight="1.7">
                  Sign up to start generating and access your video once it's complete.
                </Text>

                <Flex gap={3} pt={2} flexWrap="wrap">
                  {['Tweak in editor', 'Download anytime', 'Free to start'].map(feature => (
                    <Flex
                      key={feature}
                      align="center"
                      gap={1.5}
                      px={3}
                      py={1.5}
                      bg="whiteAlpha.100"
                      borderRadius="full"
                      border="1px solid"
                      borderColor="whiteAlpha.100"
                    >
                      <Icon as={FiCheck} boxSize={3} color="green.400" />
                      <Text fontSize="xs" color="gray.300" fontWeight="medium">
                        {feature}
                      </Text>
                    </Flex>
                  ))}
                </Flex>
              </VStack>
            </VStack>
          </Box>
        )}

        <Container
          maxW="md"
          bg="whiteAlpha.100"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="lg"
          p={8}
          flex={promptToken ? 'none' : undefined}
          w={promptToken ? { base: 'full', lg: 'md' } : 'full'}
          order={{ base: 1, lg: 2 }}
        >
          <Stack spacing={8}>
            <Stack spacing={2} textAlign="center">
              <Heading as="h1" fontSize="4xl" fontWeight="bold" color="white">
                {promptToken ? 'Almost there' : 'Welcome'}
              </Heading>
            </Stack>

            <Stack spacing={6}>
              <form noValidate onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={4}>
                  <FormControl isInvalid={!!errors.email}>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      bg="gray.800"
                      borderColor="gray.600"
                      color="white"
                      _placeholder={{ color: 'gray.400' }}
                      height="48px"
                      {...register('email', {
                        required: 'Email is required.',
                        pattern: {
                          value: /\S+@\S+\.\S+/,
                          message: 'Please enter a valid email address'
                        },
                        validate: value => {
                          if (isDisposableEmail(value)) {
                            return 'Disposable email addresses are not allowed. Please use a permanent email address.';
                          }
                          return true;
                        }
                      })}
                    />
                    <FormErrorMessage>{errors.email?.message?.toString()}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.password}>
                    <Input
                      type="password"
                      placeholder="Password"
                      bg="gray.800"
                      borderColor="gray.600"
                      color="white"
                      _placeholder={{ color: 'gray.400' }}
                      height="48px"
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password should be at least 6 characters.'
                        }
                      })}
                    />
                    <FormErrorMessage>{errors.password?.message?.toString()}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.acceptTerms}>
                    <Controller
                      name="acceptTerms"
                      control={control}
                      rules={{ required: 'You must accept the terms of service' }}
                      render={({ field: { value, ...rest } }) => (
                        <Checkbox isChecked={value} {...rest} colorScheme="gray" borderColor="gray.600">
                          <Text fontSize="sm" color="gray.400">
                            I agree to the{' '}
                            <ChakraLink
                              href="https://www.1703.co/terms"
                              target="_blank"
                              color="gray.300"
                              textDecoration="underline"
                            >
                              Terms of Service
                            </ChakraLink>{' '}
                            and confirm that I have the rights to upload and use the content I share.
                          </Text>
                        </Checkbox>
                      )}
                    />
                    <FormErrorMessage>{errors.acceptTerms?.message?.toString()}</FormErrorMessage>
                  </FormControl>

                  <Button
                    type="submit"
                    bg="white"
                    color="black"
                    _hover={{ bg: 'gray.200' }}
                    height="48px"
                    fontSize="lg"
                    isLoading={isSubmitting || isLoading}
                    isDisabled={isLoading || !watch('acceptTerms')}
                  >
                    {mode === 'register' ? 'Sign up' : 'Sign in'}
                  </Button>
                </Stack>
              </form>

              <Stack spacing={2} textAlign="center">
                <Text fontSize="sm">
                  {mode === 'register' ? (
                    <>
                      <Text as="span" color="gray.400">Already have an account? </Text>
                      <ChakraLink
                        color="white"
                        textDecoration="underline"
                        cursor="pointer"
                        onClick={() => setMode('login')}
                      >
                        Sign in instead
                      </ChakraLink>
                    </>
                  ) : (
                    <>
                      <Text as="span" color="gray.400">Don't have an account? </Text>
                      <ChakraLink
                        color="white"
                        textDecoration="underline"
                        cursor="pointer"
                        onClick={() => setMode('register')}
                      >
                        Sign up instead
                      </ChakraLink>
                    </>
                  )}
                </Text>
              </Stack>
            </Stack>
          </Stack>
        </Container>
      </Flex>
    </Box>
  );
};
