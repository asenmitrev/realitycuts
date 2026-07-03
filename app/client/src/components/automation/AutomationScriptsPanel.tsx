import { useState } from 'react';
import {
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Collapse,
  Heading,
  VStack,
  Text,
  Badge,
  Button,
  HStack,
  ButtonGroup,
  useColorModeValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Textarea,
  Input,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import {
  useAutomationScripts,
  useDeleteAutomationScriptsBySource,
  useDeleteAutomationScript,
  useUpdateAutomationScript
} from '../../hooks/useAutomationScripts';
import { useAutomationConfig } from '../../hooks/useAutomationConfig';
import type { FC } from 'react';
import type { IAutomationScript } from '../../types';

interface Props {
  configId: string;
}

type ScriptFilter = 'all' | 'available' | 'used';

export const AutomationScriptsPanel: FC<Props> = ({ configId }) => {
  const textColor = useColorModeValue('white', 'white');
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const bgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const { data: scripts, isLoading } = useAutomationScripts(configId);
  const { data: config } = useAutomationConfig(configId);
  const updateMut = useUpdateAutomationScript(configId);
  const deleteMut = useDeleteAutomationScript(configId);
  const deleteBySourceMut = useDeleteAutomationScriptsBySource(configId);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editing, setEditing] = useState<IAutomationScript | null>(null);
  const [editTopic, setEditTopic] = useState('');
  const [editScript, setEditScript] = useState('');
  const [scriptFilter, setScriptFilter] = useState<ScriptFilter>('all');
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const activeSources = config?.contentSettings?.sources?.filter(s => s.uploadId && !s.isDeleted) ?? [];

  const openEdit = (s: IAutomationScript) => {
    setEditing(s);
    setEditTopic(s.topic);
    setEditScript(s.script);
    onOpen();
  };

  const toggleExpanded = (scriptId: string) => {
    setExpandedById(prev => ({ ...prev, [scriptId]: !prev[scriptId] }));
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateMut.mutateAsync({
        scriptId: editing._id,
        topic: editTopic,
        script: editScript
      });
      toast({ title: 'Script updated', status: 'success' });
      onClose();
    } catch {
      toast({ title: 'Update failed', status: 'error' });
    }
  };

  const available = scripts?.filter(s => s.status === 'available').length ?? 0;
  const used = scripts?.filter(s => s.status === 'used').length ?? 0;
  const filteredScripts =
    scriptFilter === 'all'
      ? scripts ?? []
      : (scripts ?? []).filter(s => s.status === scriptFilter);
  const scriptsCountBySourceId = new Map<string, number>();
  for (const script of scripts ?? []) {
    const sourceId = script.sourceUploadId;
    if (!sourceId) continue;
    scriptsCountBySourceId.set(sourceId, (scriptsCountBySourceId.get(sourceId) ?? 0) + 1);
  }

  return (
    <>
      <AccordionItem
        borderTop="4px solid"
        borderTopColor="purple.400"
        borderLeft="1px solid"
        borderRight="1px solid"
        borderBottom="1px solid"
        borderLeftColor={borderColor}
        borderRightColor={borderColor}
        borderBottomColor={borderColor}
        borderRadius="lg"
        bg={bgColor}
        mb={4}
      >
        <AccordionButton py={4}>
          <Box flex="1" textAlign="left">
            <Heading as="h2" size="md" color={textColor}>
              Generated scripts
            </Heading>
            <Text fontSize="sm" color={textColor} opacity={0.85}>
              {isLoading ? 'Loading…' : `${available} available · ${used} used · ${scripts?.length ?? 0} total`}
            </Text>
          </Box>
          <AccordionIcon />
        </AccordionButton>
        <AccordionPanel pb={4}>
          {activeSources.length > 0 && (
            <VStack mb={4} spacing={2} align="stretch">
              {activeSources.map(source => {
                const sourceId = source.uploadId ?? '';
                const scriptsFromSource = scriptsCountBySourceId.get(sourceId) ?? 0;
                return (
                  <HStack key={sourceId} spacing={2} justify="space-between" flexWrap="wrap">
                    <Text color={textColor} fontSize="sm" opacity={0.9}>
                      {source.fileName || 'PDF'} ({scriptsFromSource} script{scriptsFromSource === 1 ? '' : 's'})
                    </Text>
                    <HStack spacing={2}>
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="red"
                        isDisabled={scriptsFromSource === 0}
                        isLoading={deleteBySourceMut.isLoading}
                        onClick={() =>
                          deleteBySourceMut.mutate(sourceId, {
                            onSuccess: () => {
                              toast({ title: 'PDF scripts removed', status: 'success' });
                            },
                            onError: () => {
                              toast({ title: 'Failed to remove PDF scripts', status: 'error' });
                            }
                          })
                        }
                      >
                        Delete scripts from PDF
                      </Button>
                    </HStack>
                  </HStack>
                );
              })}
            </VStack>
          )}
          <HStack justify="space-between" mb={3} flexWrap="wrap" gap={2}>
            <Text color={textColor} fontSize="sm" opacity={0.9}>
              Filter scripts
            </Text>
            <ButtonGroup isAttached size="sm" variant="outline">
              <Button
                onClick={() => setScriptFilter('all')}
                isActive={scriptFilter === 'all'}
                aria-pressed={scriptFilter === 'all'}
              >
                All ({scripts?.length ?? 0})
              </Button>
              <Button
                onClick={() => setScriptFilter('available')}
                isActive={scriptFilter === 'available'}
                aria-pressed={scriptFilter === 'available'}
              >
                Available ({available})
              </Button>
              <Button
                onClick={() => setScriptFilter('used')}
                isActive={scriptFilter === 'used'}
                aria-pressed={scriptFilter === 'used'}
              >
                Used ({used})
              </Button>
            </ButtonGroup>
          </HStack>
          <VStack align="stretch" spacing={3}>
            {filteredScripts.map(s => (
              <Box key={s._id} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                <HStack justify="space-between" mb={1}>
                  <Text color={textColor} fontWeight="bold" noOfLines={1}>
                    {s.topic}
                  </Text>
                  <Badge colorScheme={s.status === 'available' ? 'green' : s.status === 'used' ? 'blue' : 'gray'}>
                    {s.status}
                  </Badge>
                </HStack>
                {(() => {
                  const isExpanded = !!expandedById[s._id];
                  const isExpandable = s.script.length > 240 || s.script.includes('\n');
                  return (
                    <>
                      <Text color={textColor} fontSize="sm" noOfLines={isExpanded ? undefined : 2} opacity={0.9}>
                        {s.script}
                      </Text>
                      {isExpandable ? (
                        <Button
                          size="xs"
                          variant="link"
                          mt={1}
                          color={textColor}
                          opacity={0.9}
                          onClick={() => toggleExpanded(s._id)}
                        >
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </Button>
                      ) : null}
                      <Collapse in={isExpanded} animateOpacity>
                        <Box
                          mt={2}
                          p={2}
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor="whiteAlpha.200"
                          bg="blackAlpha.300"
                        >
                          <Text color={textColor} fontSize="sm" whiteSpace="pre-wrap" opacity={0.95}>
                            {s.script}
                          </Text>
                        </Box>
                      </Collapse>
                    </>
                  );
                })()}
                <HStack mt={2} spacing={2}>
                  <Button size="xs" onClick={() => openEdit(s)}>
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    colorScheme="red"
                    isLoading={deleteMut.isLoading}
                    onClick={() =>
                      deleteMut.mutate(s._id, {
                        onSuccess: () => {
                          toast({ title: 'Script removed', status: 'success' });
                        },
                        onError: () => {
                          toast({ title: 'Remove failed', status: 'error' });
                        }
                      })
                    }
                  >
                    Delete
                  </Button>
                </HStack>
              </Box>
            ))}
            {!isLoading && (!scripts || scripts.length === 0) ? (
              <Text color={textColor} opacity={0.8} fontSize="sm">
                No scripts yet. Upload a PDF in Content Settings and save the automation.
              </Text>
            ) : !isLoading && scripts && scripts.length > 0 && filteredScripts.length === 0 ? (
              <Text color={textColor} opacity={0.8} fontSize="sm">
                No scripts match this filter.
              </Text>
            ) : null}
          </VStack>
        </AccordionPanel>
      </AccordionItem>

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent bg="gray.900" borderColor="whiteAlpha.300" borderWidth="1px">
          <ModalHeader color={textColor}>Edit script</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={2} color={textColor} fontSize="sm">
              Topic
            </Text>
            <Input
              value={editTopic}
              onChange={e => setEditTopic(e.target.value)}
              mb={4}
              color={textColor}
              borderColor="whiteAlpha.400"
            />
            <Text mb={2} color={textColor} fontSize="sm">
              Script
            </Text>
            <Textarea
              value={editScript}
              onChange={e => setEditScript(e.target.value)}
              minH="200px"
              color={textColor}
              borderColor="whiteAlpha.400"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={() => void saveEdit()} isLoading={updateMut.isLoading}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
