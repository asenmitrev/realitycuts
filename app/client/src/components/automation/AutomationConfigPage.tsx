import { FC } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Spinner, VStack, Text, Alert, AlertIcon } from '@chakra-ui/react';
import { AutomationConfigForm } from './AutomationConfigForm';
import { useAutomationConfig } from '../../hooks/useAutomationConfig';

export const NewAutomationConfigPage: FC = () => {
  return <AutomationConfigForm />;
};

export const EditAutomationConfigPage: FC = () => {
  const { id } = useParams(); // Changed from channelId to id
  const { data: config, isLoading, error } = useAutomationConfig(id); // Now uses id instead of channelId

  if (isLoading) {
    return (
      <Container maxW="4xl" py={8} centerContent>
        <Spinner size="lg" />
      </Container>
    );
  }

  if (error || !config) {
    return (
      <Container maxW="4xl" py={8}>
        <Alert status="error">
          <AlertIcon />
          <VStack align="start" spacing={1}>
            <Text fontWeight="bold">Error loading automation config</Text>
            <Text fontSize="sm">
              {error ? 'Failed to load the automation configuration.' : 'Automation configuration not found.'}
            </Text>
          </VStack>
        </Alert>
      </Container>
    );
  }

  return <AutomationConfigForm existingConfig={config} isEdit={true} />;
};
