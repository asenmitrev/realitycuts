import { FC, useCallback, useEffect, useState } from 'react';
import { Box, Button, Container, Grid, GridItem, Heading, Text, useToast, Image, IconButton } from '@chakra-ui/react';
import { useApiService } from '../../hooks/useApiService';
import { IS3Upload } from 'shared/types';
import { DeleteIcon } from '@chakra-ui/icons';
import { useConfirmDialogV2 } from '../../hooks/useConfirmDialog';
import {
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Progress,
  VStack,
  HStack
} from '@chakra-ui/react';
import { MyDropzone } from '../upload/MyDropzone';
import { UploadProgressIndicator } from '../upload/UploadProgressIndicator';
import { AxiosProgressEvent } from 'axios';

type BrandAsset = {
  _id: string;
  s3UploadId: IS3Upload;
  name?: string;
  createdAt?: string;
};

type UploadCreateResponse = { uploadId: string; presignedUrl: string; s3Key: string };

export const BrandAssetsPage: FC = () => {
  const api = useApiService();
  const toast = useToast();
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [uploadItems, setUploadItems] = useState<
    {
      key: string;
      file: File;
      progress?: AxiosProgressEvent;
      status: 'uploading' | 'confirming' | 'done' | 'error';
      error?: string;
    }[]
  >([]);

  const { dialogContent, awaitConfirmation } = useConfirmDialogV2({
    title: 'Delete this brand asset?',
    type: 'delete',
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ assets: BrandAsset[] }>(`/api/brand-assets`);
      setAssets(res.assets || []);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const startUpload = useCallback(
    async (file: File) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      setUploadItems(prev => [...prev, { key, file, status: 'uploading' }]);
      try {
        const { uploadId, presignedUrl } = await api.post<
          UploadCreateResponse,
          {
            filename: string;
            contentType: string;
            size: number;
          }
        >(`/api/upload/presigned`, {
          filename: file.name,
          contentType: file.type,
          size: file.size
        });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', event => {
            if (event.lengthComputable) {
              const progress: AxiosProgressEvent = {
                loaded: event.loaded,
                total: event.total,
                progress: event.total ? event.loaded / event.total : undefined
              } as AxiosProgressEvent;
              setUploadItems(prev => prev.map(item => (item.key === key ? { ...item, progress } : item)));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`S3 upload failed with status ${xhr.status}: ${xhr.statusText}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('S3 upload failed due to network error'));
          });

          xhr.addEventListener('timeout', () => {
            reject(new Error('S3 upload timed out'));
          });

          xhr.addEventListener('abort', () => {
            reject(new Error('S3 upload was aborted'));
          });

          xhr.open('PUT', presignedUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.timeout = 30 * 60 * 1000;
          xhr.send(file);
        });

        setUploadItems(prev => prev.map(item => (item.key === key ? { ...item, status: 'confirming' } : item)));

        await api.post(`/api/upload/${uploadId}/confirm`, {});
        await api.post(`/api/brand-assets`, { uploadId, name: file.name });

        setUploadItems(prev => prev.map(item => (item.key === key ? { ...item, status: 'done' } : item)));
        fetchAssets();
        onClose();
      } catch (e) {
        console.error(e);
        setUploadItems(prev =>
          prev.map(item => (item.key === key ? { ...item, status: 'error', error: (e as Error)?.message } : item))
        );
        toast({ title: 'Upload failed', description: (e as Error)?.message, status: 'error' });
      }
    },
    [api, fetchAssets, onClose, toast]
  );

  const onDrop = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      const ignored = files.length - imageFiles.length;
      if (ignored > 0) {
        toast({ title: `Ignored ${ignored} non-image file(s)`, status: 'warning' });
      }
      if (imageFiles.length === 0) return;
      await Promise.all(imageFiles.map(f => startUpload(f)));
    },
    [startUpload, toast]
  );

  const allDoneOrError = uploadItems.length > 0 && uploadItems.every(u => u.status === 'done' || u.status === 'error');
  const anyInProgress = uploadItems.some(u => u.status === 'uploading' || u.status === 'confirming');

  const onDelete = async (id: string) => {
    await awaitConfirmation();
    setDeletingId(id);
    try {
      await api.delete(`/api/brand-assets/${id}`);
      toast({ title: 'Deleted', status: 'success' });
      fetchAssets();
    } catch (e) {
      toast({ title: 'Delete failed', status: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Container maxW="6xl" py={8}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={6}>
        <Heading size="lg">Brand Assets</Heading>
        <Button onClick={onOpen} colorScheme="white" variant="outline" isLoading={isLoading}>
          Upload Image
        </Button>
      </Box>
      {assets.length === 0 ? (
        <Text color="gray.300">No brand assets yet. Upload your logo to use as a watermark.</Text>
      ) : (
        <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={6}>
          {assets.map(a => {
            const isImage = a.s3UploadId.mimeType.startsWith('image/');
            return (
              <GridItem
                key={a._id}
                borderWidth="1px"
                borderColor="whiteAlpha.300"
                borderRadius="md"
                p={3}
                position="relative"
              >
                {/* We only have uploadId; preview can be rendered server-side later; for now show name */}
                {isImage ? (
                  <Image src={a.s3UploadId.url} alt={a.name ?? a._id} />
                ) : (
                  <Box w="100%" h="120px" bg="whiteAlpha.200" />
                )}
                <Text
                  mt={2}
                  fontSize="sm"
                  color="whiteAlpha.800"
                  noOfLines={1}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  {a.name ?? a._id}
                  <IconButton
                    aria-label="Delete asset"
                    icon={<DeleteIcon />}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    isLoading={deletingId === a._id}
                    onClick={() => onDelete(a._id)}
                  />
                </Text>
              </GridItem>
            );
          })}
        </Grid>
      )}
      {dialogContent}

      <Modal
        isOpen={isOpen}
        onClose={() => {
          if (!anyInProgress) {
            setUploadItems([]);
            onClose();
          }
        }}
        size="xl"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upload Brand Images</ModalHeader>
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <MyDropzone onDrop={onDrop} height={120} type="mixed-video-image" />
              {uploadItems.length > 0 && (
                <VStack align="stretch" spacing={3}>
                  {uploadItems.map(item => (
                    <Box key={item.key} p={3} bg="whiteAlpha.100" borderRadius="md">
                      <HStack justifyContent="space-between">
                        <Text fontSize="sm" color="gray.300">
                          {item.file.name}
                        </Text>
                        <Text fontSize="xs" color="gray.400">
                          {item.status}
                        </Text>
                      </HStack>
                      {item.progress ? (
                        <UploadProgressIndicator progress={item.progress} />
                      ) : item.status === 'confirming' ? (
                        <Progress isIndeterminate colorScheme="green" />
                      ) : null}
                      {item.status === 'error' && item.error ? (
                        <Text fontSize="xs" color="red.300" mt={1}>
                          {item.error}
                        </Text>
                      ) : null}
                    </Box>
                  ))}
                </VStack>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              mr={3}
              onClick={() => {
                setUploadItems([]);
                onClose();
              }}
              isDisabled={anyInProgress}
            >
              {allDoneOrError ? 'Close' : 'Cancel'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};
