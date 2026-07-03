import { FC } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Text,
  Box,
  Button,
  Spinner
} from '@chakra-ui/react';
import { useApiService } from '../../hooks/useApiService';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

interface DownloadModalProps {
  brollId: number;
  isOpen: boolean;
  onClose: () => void;
}

type DownloadLinks = string | Record<string, string | Record<string, string>>;

export const DownloadModal: FC<DownloadModalProps> = ({ brollId, isOpen, onClose }) => {
  const apiService = useApiService();

  const { isLoading, data } = useQuery({
    queryKey: ['broll-download', brollId],
    queryFn: () => {
      return apiService.get<DownloadLinks>(`/api/broll/${brollId}/download`);
    },
    enabled: isOpen && brollId > 0,
    refetchOnMount: 'always'
  });

  const renderLinks = (obj: DownloadLinks) => {
    if (typeof obj === 'object') {
      return Object.entries(obj).map(([key, val]) => {
        return (
          <Box pl={4}>
            <Text as="span" mr={4}>
              {key}:
            </Text>
            <Text as="span">{renderLinks(val)}</Text>
          </Box>
        );
      });
    } else {
      return (
        <Link style={{ color: 'white', textDecoration: 'underline' }} to={obj} target="_blank">
          Link
        </Link>
      );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <ModalCloseButton />
        </ModalHeader>
        <ModalBody display="flex" flexDir="column" gap={8}>
          {isLoading ? <Spinner /> : <>{data && renderLinks(data)}</>}
        </ModalBody>
        <ModalFooter>
          <Button mr={4} variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
