import { FC } from 'react';
import { Progress, Flex, Box } from '@chakra-ui/react';
import { AxiosProgressEvent } from 'axios';
import { formatBytes } from '../../utils/upload';

export const UploadProgressIndicator: FC<{ progress: AxiosProgressEvent }> = ({ progress }) => {
  return (
    <>
      <Progress colorScheme="green" value={(progress.progress ?? 0) * 100} />
      <Flex direction="column">
        <Box>
          Loaded: {formatBytes(progress.loaded, 0)} / {formatBytes(progress.total ?? 0, 0)}
        </Box>
        <Box>Upload Speed: {formatBytes(progress.rate ?? 0, 1)}/s</Box>
        <Box>Estimated Time Left: {Math.ceil(progress.estimated ?? 0)} s</Box>
      </Flex>
    </>
  );
};
