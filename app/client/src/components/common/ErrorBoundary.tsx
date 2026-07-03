import React from 'react';
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={8} display="flex" justifyContent="center" alignItems="center" minH="100vh">
          <VStack spacing={6} align="center">
            <Heading size="lg">Something went wrong</Heading>
            <Text>We apologize for the inconvenience. Please try refreshing the page.</Text>
            <Button
              colorScheme="white"
              onClick={() => {
                window.location.reload();
              }}
            >
              Refresh Page
            </Button>
          </VStack>
        </Box>
      );
    }

    return this.props.children;
  }
}
