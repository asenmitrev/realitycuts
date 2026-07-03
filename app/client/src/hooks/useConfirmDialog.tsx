import { useCallback, useRef, useState, useMemo } from 'react';
import {
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Button,
  Icon,
  HStack,
  Text
} from '@chakra-ui/react';
import { FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';

type useConfirmDialogProps = {
  type: 'delete' | 'confirm';
  title: string;
  confirmText?: string;
  cancelText?: string;
  body?: string;
};
export const useConfirmDialog = ({ title, type, confirmText, cancelText, body }: useConfirmDialogProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef(null);
  const [resolvePromise, setResolvePromise] = useState<(v: unknown) => void>();
  const [rejectPromise, setRejectPromise] = useState<() => void>();

  const awaitConfirmation = useCallback(async () => {
    await new Promise((resolve, reject) => {
      onOpen();
      setResolvePromise(() => resolve);
      setRejectPromise(() => reject);
    });
  }, [onOpen]);

  const closeDialog = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(true);
    }
    closeDialog();
  }, [resolvePromise, closeDialog]);

  const handleCancel = useCallback(() => {
    if (rejectPromise) {
      rejectPromise();
    }
    closeDialog();
  }, [rejectPromise, closeDialog]);

  const renderDialog = useMemo(
    () => () =>
      (
        <>
          {isOpen ? (
            <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} isCentered onClose={onClose}>
              <AlertDialogOverlay backdropFilter="blur(8px)" bg="blackAlpha.600">
                <AlertDialogContent
                  mx={4}
                  borderRadius="xl"
                  boxShadow="2xl"
                  bg="gray.800"
                  borderWidth="1px"
                  borderColor="whiteAlpha.200"
                >
                  <AlertDialogHeader fontSize="xl" fontWeight="bold" pt={6} pb={4} px={6}>
                    <HStack spacing={3} align="center">
                      <Icon
                        as={type === 'delete' ? FaExclamationTriangle : FaCheckCircle}
                        color={type === 'delete' ? 'red.400' : 'green.400'}
                        boxSize={6}
                      />
                      <Text color="white">{title}</Text>
                    </HStack>
                  </AlertDialogHeader>

                  <AlertDialogBody px={6} pb={2} color="gray.300" fontSize="md">
                    {body ||
                      (type === 'delete' ? "Are you sure? You can't undo this action afterwards." : 'Are you sure?')}
                  </AlertDialogBody>

                  <AlertDialogFooter pt={6} pb={6} px={6} gap={3}>
                    <Button
                      ref={cancelRef}
                      onClick={handleCancel}
                      variant="outline"
                      colorScheme="gray"
                      size="md"
                      _hover={{ bg: 'whiteAlpha.100' }}
                    >
                      {cancelText || 'Cancel'}
                    </Button>
                    <Button
                      colorScheme={type === 'delete' ? 'red' : 'white'}
                      onClick={handleConfirm}
                      size="md"
                      fontWeight="semibold"
                      _hover={{
                        transform: 'translateY(-1px)',
                        boxShadow: 'lg'
                      }}
                      transition="all 0.2s"
                    >
                      {confirmText || (type === 'delete' ? 'Delete' : 'Confirm')}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialogOverlay>
            </AlertDialog>
          ) : null}
        </>
      ),
    [isOpen, onClose, title, type, handleCancel, cancelText, handleConfirm, confirmText, body]
  );

  return {
    renderDialog,
    awaitConfirmation
  };
};

export const useConfirmDialogV2 = ({ title, type, confirmText, cancelText, body }: useConfirmDialogProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef(null);
  const [resolvePromise, setResolvePromise] = useState<(v: unknown) => void>();
  const [rejectPromise, setRejectPromise] = useState<() => void>();

  const awaitConfirmation = useCallback(async () => {
    await new Promise((resolve, reject) => {
      onOpen();
      setResolvePromise(() => resolve);
      setRejectPromise(() => reject);
    });
  }, [onOpen]);

  const closeDialog = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(true);
    }
    closeDialog();
  }, [resolvePromise, closeDialog]);

  const handleCancel = useCallback(() => {
    if (rejectPromise) {
      rejectPromise();
    }
    closeDialog();
  }, [rejectPromise, closeDialog]);

  const dialogContent = useMemo(
    () => (
      <>
        {isOpen ? (
          <AlertDialog
            isOpen={isOpen}
            leastDestructiveRef={cancelRef}
            isCentered
            onClose={() => {
              onClose();
              if (rejectPromise) {
                rejectPromise();
              }
            }}
          >
            <AlertDialogOverlay backdropFilter="blur(8px)" bg="blackAlpha.600">
              <AlertDialogContent
                mx={4}
                borderRadius="xl"
                boxShadow="2xl"
                bg="gray.800"
                borderWidth="1px"
                borderColor="whiteAlpha.200"
              >
                <AlertDialogHeader fontSize="xl" fontWeight="bold" pt={6} pb={4} px={6}>
                  <HStack spacing={3} align="center">
                    <Icon
                      as={type === 'delete' ? FaExclamationTriangle : FaCheckCircle}
                      color={type === 'delete' ? 'red.400' : 'green.400'}
                      boxSize={6}
                    />
                    <Text color="white">{title}</Text>
                  </HStack>
                </AlertDialogHeader>

                <AlertDialogBody px={6} pb={2} color="gray.300" fontSize="md">
                  {body ||
                    (type === 'delete' ? "Are you sure? You can't undo this action afterwards." : 'Are you sure?')}
                </AlertDialogBody>

                <AlertDialogFooter pt={6} pb={6} px={6} gap={3}>
                  <Button
                    ref={cancelRef}
                    onClick={handleCancel}
                    variant="outline"
                    colorScheme="gray"
                    size="md"
                    _hover={{ bg: 'whiteAlpha.100' }}
                  >
                    {cancelText || 'Cancel'}
                  </Button>
                  <Button
                    colorScheme={type === 'delete' ? 'red' : 'blue'}
                    onClick={handleConfirm}
                    size="md"
                    fontWeight="semibold"
                    _hover={{
                      transform: 'translateY(-1px)',
                      boxShadow: 'lg'
                    }}
                    transition="all 0.2s"
                  >
                    {confirmText || (type === 'delete' ? 'Delete' : 'Confirm')}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>
        ) : null}
      </>
    ),
    [isOpen, onClose, title, type, handleCancel, handleConfirm, confirmText, cancelText, body]
  );

  return {
    dialogContent,
    awaitConfirmation
  };
};
