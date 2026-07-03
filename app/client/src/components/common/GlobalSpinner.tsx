import { Container, Spinner } from '@chakra-ui/react';
import { FC } from 'react';

export const GlobalSpinner: FC = () => {
  return (
    <Container minW="200px" minH="350px" display="flex" alignItems="center" justifyContent="center">
      <Spinner />
    </Container>
  );
};
