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
  Link as ChakraLink,
  useToast
} from '@chakra-ui/react';
import { FC, useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthUser, useIsAuthInitializing } from '../../contexts/auth/hooks';
import { useAuthService } from '../../contexts/auth/hooks';
import { useApiService } from '../../hooks/useApiService';
import { isErrorWithMessage } from 'shared/helperFunctions';
import { isDisposableEmail } from './utils';

interface PasswordSignInFormData {
  email: string;
  password: string;
}

export const PasswordSignIn: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect');
  const promptToken = params.get('prompt_token');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthService();
  const user = useAuthUser();
  const authInitializing = useIsAuthInitializing();
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting }
  } = useForm<PasswordSignInFormData>();
  const toast = useToast();
  const apiService = useApiService();

  const getRedirectUrl = useCallback(() => {
    if (promptToken) {
      return `/preuser-prompt?prompt_token=${promptToken}`;
    }
    return redirect || '/';
  }, [promptToken, redirect]);

  useEffect(() => {
    if (user && !authInitializing) {
      navigate(getRedirectUrl());
    }
  }, [user, authInitializing, navigate, getRedirectUrl]);

  const onSubmit = async ({ email, password }: PasswordSignInFormData) => {
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result) {
        await afterLoginService(result.user.id);
      }
      navigate(getRedirectUrl());
    } catch (e: unknown) {
      if (isErrorWithMessage(e)) {
        toast({
          status: 'error',
          description: e.message || 'Error logging in with password.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const afterLoginService = async (userId: string) => {
    try {
      await apiService.post<{ message: string }, { firebaseId: string }>(
        '/api/afterlogin',
        { firebaseId: userId }
      );
    } catch (error) {
      console.error('Error with after login:', error);
    }
  };

  return (
    <Box minH="100vh" py={12} px={4} display="flex" alignItems="center" justifyContent="center">
      <Container maxW="md" bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="lg" p={8}>
        <Stack spacing={8}>
          <Stack spacing={2} textAlign="center">
            <Heading as="h1" fontSize="4xl" fontWeight="bold" color="white">
              Sign in with password
            </Heading>
            <Text fontSize="xl" color="gray.400">
              For existing users with password accounts
            </Text>
          </Stack>

          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={4}>
              <FormControl isInvalid={!!errors.email}>
                <Input
                  type="email"
                  placeholder="Email"
                  bg="gray.800"
                  borderColor="gray.600"
                  color="white"
                  _placeholder={{ color: 'gray.400' }}
                  height="48px"
                  {...register('email', {
                    required: 'Email is required to sign in.',
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
                    required: 'Password is required to sign in',
                    minLength: {
                      value: 6,
                      message: 'Password should be at least 6 characters.'
                    }
                  })}
                />
                <FormErrorMessage>{errors.password?.message?.toString()}</FormErrorMessage>
              </FormControl>

              <Button
                type="submit"
                bg="white"
                color="black"
                _hover={{ bg: 'gray.200' }}
                height="48px"
                fontSize="lg"
                isLoading={isSubmitting || isLoading}
                isDisabled={isLoading}
              >
                Sign in
              </Button>
            </Stack>
          </form>

          <Stack spacing={4} textAlign="center">
            <Text fontSize="sm" color="gray.500">
              <ChakraLink
                as={Link}
                to={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'}
                color="white"
                textDecoration="underline"
              >
                Back to sign-up
              </ChakraLink>
            </Text>

            <Text fontSize="sm">
              <Text as="span" color="gray.400">
                Don't have an account?{' '}
              </Text>
              <ChakraLink as={Link} to="/login" color="white" textDecoration="underline">
                Sign up instead
              </ChakraLink>
            </Text>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};
