import { FC, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useApiService } from '../../hooks/useApiService';

export const Unsubscribe: FC = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const apiService = useApiService();
  const email = searchParams.get('email');

  const unsubscribe = async () => {
    if (!email) {
      setError('No email provided');
      setIsLoading(false);
      return;
    }

    try {
      await apiService.post('/api/unsubscribe', { email });
      setSuccess(true);
    } catch (err) {
      setError('Failed to unsubscribe. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box p={8} maxW="600px" mx="auto">
      <VStack spacing={6} align="center">
        <Heading size="lg">Email Preferences</Heading>

        {!success && (
          <>
            <Text>Do you wish to unsubscribe the email {email} from our emails?</Text>
            <Button isLoading={isLoading} isDisabled={isLoading} onClick={unsubscribe}>
              Unsubscribe
            </Button>
          </>
        )}

        {error && <Text color="red.500">{error}</Text>}

        {success && <Text>Email {email} has been successfully unsubscribed from our emails.</Text>}
      </VStack>
    </Box>
  );
};
