import { FC, Fragment, useRef, useState, Dispatch, useMemo, memo, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RangeSlider,
  RangeSliderFilledTrack,
  RangeSliderThumb,
  RangeSliderTrack,
  Text,
  useDisclosure,
  useOutsideClick
} from '@chakra-ui/react';
import { FaPlus, FaMinus } from 'react-icons/fa6';
import { HighlightEditorState, HighlightEditorAction, WordBaseEdited, WordBase, Sentence } from '../../types';
import { FaCropAlt, FaRegEdit } from 'react-icons/fa';
import { FormProvider, useForm } from 'react-hook-form';
import { noop } from 'lodash';
import { useVideoEditorStore } from '../../stores/video-editor/store';

const SHOW_EXTRA_LINES = 5;

interface RenameSpeakerFormData {
  speakerName: string;
}
const RenameSpeakerModal: FC<{
  speakerName: string;
  onRename: (data: RenameSpeakerFormData) => void;
  onClose: () => void;
}> = ({ onRename, speakerName, onClose }) => {
  const [isSaving, setIsSaving] = useState(false);
  const methods = useForm<RenameSpeakerFormData>({
    defaultValues: {
      speakerName
    }
  });
  const {
    handleSubmit,
    register,
    formState: { errors }
  } = methods;

  const onSubmit = async (data: RenameSpeakerFormData) => {
    try {
      setIsSaving(true);
      await onRename(data);
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <Modal isOpen={true} onClose={onClose} size="sm">
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton />
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader>
              <Heading size="md">Change Speaker Alias</Heading>
            </ModalHeader>
            <ModalBody>
              <FormControl isInvalid={!!errors.speakerName?.message}>
                <Input
                  {...register('speakerName', {
                    required: 'Speaker name is required.'
                  })}
                  type="text"
                />
                <FormErrorMessage>{errors.speakerName?.message?.toString()}</FormErrorMessage>
                <FormHelperText>
                  Choose a friendly name for this speaker to more easily identify them in the transcript.
                </FormHelperText>
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button mr={4} variant="outline" onClick={onClose} type="button">
                Cancel
              </Button>
              <Button variant="solid" type="submit" isLoading={isSaving}>
                Save
              </Button>
            </ModalFooter>
          </form>
        </FormProvider>
      </ModalContent>
    </Modal>
  );
};

export const EditorPopupMenu: FC<{
  selectedWordIds: number[];
  editorState: HighlightEditorState;
  isEnabled: boolean;
  onClose: () => void;
  onRetranscribe: (selectedWordIds: number[]) => void;
  editorDispatch: Dispatch<HighlightEditorAction>;
  onRegenerateBroll: (selectedWordIds: number[]) => void;
}> = ({ selectedWordIds, editorState, editorDispatch, onClose }) => {
  const [editedWord, setEditedWord] = useState<WordBaseEdited>();
  const [editedSpellingWord, setEditedSpellingWord] = useState<WordBaseEdited>();
  if (editedSpellingWord) {
    return (
      <Box w="300px" px={4} py={2}>
        <Text fontSize="small">Change word spelling</Text>
        <Input
          autoFocus
          onChange={e => {
            editorDispatch({
              type: 'CHANGE_WORD_SPELLING',
              payload: {
                wordIndex: editedSpellingWord.wordIndex!,
                word: e.target.value
              }
            });
          }}
        />
      </Box>
    );
  }
  if (editedWord) {
    return (
      <Box w="300px" px={4} py={2}>
        <Text fontSize="small">Change word timing</Text>
        <RangeSlider
          defaultValue={[editedWord.start, editedWord.end]}
          step={0.005}
          min={editedWord.start - 0.25}
          max={editedWord.end + 0.25}
          onChangeEnd={e => {
            editorDispatch({
              type: 'CHANGE_WORD_TIMING',
              payload: {
                wordIndex: editedWord.wordIndex!,
                start: e[0],
                end: e[1]
              }
            });
            onClose();
          }}
        >
          <RangeSliderTrack bg="red.100">
            <RangeSliderFilledTrack bg="tomato" />
          </RangeSliderTrack>
          <RangeSliderThumb boxSize={6} index={0} />
          <RangeSliderThumb boxSize={6} index={1} />
        </RangeSlider>
      </Box>
    );
  }
  return (
    <>
      <Button
        size="sm"
        gap={2}
        variant="ghost"
        justifyContent="stretch"
        onClick={() => {
          editorDispatch({
            type: 'CHANGE_WORDS_VISIBILITY',
            payload: {
              wordIds: selectedWordIds,
              isVisible: true
            }
          });
          onClose();
        }}
      >
        <FaPlus />
        Add
      </Button>
      <Button
        size="sm"
        gap={2}
        variant="ghost"
        justifyContent="stretch"
        onClick={() => {
          editorDispatch({
            type: 'CHANGE_WORDS_VISIBILITY',
            payload: {
              wordIds: selectedWordIds,
              isVisible: false
            }
          });
          onClose();
        }}
      >
        <FaMinus />
        Delete
      </Button>
      {selectedWordIds?.length === 1 && null && (
        <Button
          size="sm"
          gap={2}
          variant="ghost"
          justifyContent="stretch"
          onClick={() => {
            for (const sentence of editorState.sentences) {
              for (const word of sentence.words) {
                if (word.wordIndex === selectedWordIds[0]) {
                  return setEditedWord(word);
                }
              }
            }
          }}
        >
          <FaCropAlt />
          Change word timing
        </Button>
      )}
      {selectedWordIds?.length === 1 && (
        <Button
          size="sm"
          gap={2}
          variant="ghost"
          justifyContent="stretch"
          onClick={() => {
            for (const sentence of editorState.sentences) {
              for (const word of sentence.words) {
                if (word.wordIndex === selectedWordIds[0]) {
                  return setEditedSpellingWord(word);
                }
              }
            }
          }}
        >
          <FaCropAlt />
          Change word spelling
        </Button>
      )}
    </>
  );
};

const ActiveWordIndicator: FC<{
  currentTime: number;
  wordId: number;
}> = memo(({ currentTime, wordId }) => {
  useEffect(() => {
    const element = document.getElementById(wordId.toString()) as HTMLElement;
    if (element) {
      element.style.backgroundColor = '#718096';

      return () => {
        if (element) {
          element.style.backgroundColor = '';
        }
      };
    }
  }, [currentTime, wordId]);

  return null;
});

const Word: FC<{
  word: WordBaseEdited;
  index: number;
  line: Sentence & {
    isVisible: boolean;
    index: number;
  };
  lines: (Sentence & {
    isVisible: boolean;
    index: number;
  })[];
  speakerMap: Record<number, string>;
  onRenameOpen: () => void;
  onChangeSpeakerMap?: (speakerNumber: number, speakerName: string) => void;
  setEditedSpeaker: (s: WordBase['speaker']) => void;
  lineIndex: number;
}> = memo(({ line, index, lineIndex, setEditedSpeaker, speakerMap, onChangeSpeakerMap, onRenameOpen, word, lines }) => {
  const lastSentence = lineIndex > 0 ? lines[lineIndex - 1] : null;
  const lastWord = index > 0 ? line.words[index - 1] : lastSentence?.words[lastSentence?.words.length - 1] ?? word;
  const speakerChange = lastWord.speaker !== word.speaker || (lineIndex === 0 && index === 0);

  const skipSpeakerMap = useMemo(() => {
    return Object.keys(speakerMap).length === 0;
  }, [speakerMap]);

  return (
    <Fragment>
      {!skipSpeakerMap && speakerChange && word.speaker !== undefined && (
        <Text
          fontSize="sm"
          color={'blue.400'}
          my={2}
          display="flex"
          fontWeight="medium"
          alignItems="center"
          gap={4}
          cursor={onChangeSpeakerMap ? 'pointer' : 'default'}
          onClick={() => {
            if (onChangeSpeakerMap) {
              setEditedSpeaker(word.speaker);
              onRenameOpen();
            }
          }}
        >
          {speakerMap[word.speaker] ?? `Speaker ${word.speaker}`}
          {onChangeSpeakerMap && <FaRegEdit />}
        </Text>
      )}
      <Text
        key={word.wordIndex}
        as="span"
        borderRadius={3}
        py={1}
        id={word.wordIndex?.toString()}
        data-word-id={word.wordIndex?.toString()}
        color={word.isVisible ? 'whiteAlpha.900' : 'whiteAlpha.600'}
      >
        {word.punctuated_word ?? word.word}
      </Text>{' '}
      {word.isParagraphEnd && (
        <>
          <br />
          <br />
        </>
      )}
    </Fragment>
  );
});

const ActiveWordTracker: FC<{
  sentences: (Sentence & { isVisible: boolean; index: number })[];
}> = memo(({ sentences }) => {
  const currentTime = useVideoEditorStore(state => state.absoluteCurrentTime);
  const [activeWordId, setActiveWordId] = useState<number | null>(null);

  useEffect(() => {
    let foundActiveWord = false;

    // Find the active word based on the current time
    for (const sentence of sentences) {
      for (let i = 0; i < sentence.words.length; i++) {
        const word = sentence.words[i];
        const lastWord = i > 0 ? sentence.words[i - 1] : { end: 0 };

        if (lastWord.end < currentTime && currentTime < word.end) {
          setActiveWordId(word.wordIndex ?? null);
          foundActiveWord = true;
          break;
        }
      }
      if (foundActiveWord) break;
    }

    if (!foundActiveWord) {
      setActiveWordId(null);
    }
  }, [currentTime, sentences]);

  if (activeWordId === null) return null;

  return <ActiveWordIndicator currentTime={currentTime} wordId={activeWordId} />;
});

const Sentences: FC<{
  sentences: (Sentence & { isVisible: boolean; index: number })[];
  speakerMap: Record<number, string>;
  onChangeSpeakerMap?: (speakerNumber: number, speakerName: string) => void;
  onRenameOpen: () => void;
  setEditedSpeaker: (s: WordBase['speaker']) => void;
}> = memo(({ sentences, speakerMap, onChangeSpeakerMap, onRenameOpen, setEditedSpeaker }) => {
  return (
    <>
      {sentences.map((line, lineIndex, lines) => (
        <Fragment key={line.index + lineIndex}>
          {line.words.map((word, index) => (
            <Word
              key={word.wordIndex}
              word={word}
              line={line}
              index={index}
              lines={lines}
              setEditedSpeaker={setEditedSpeaker}
              lineIndex={lineIndex}
              speakerMap={speakerMap}
              onRenameOpen={onRenameOpen}
              onChangeSpeakerMap={onChangeSpeakerMap}
            />
          ))}
        </Fragment>
      ))}
      <ActiveWordTracker sentences={sentences} />
    </>
  );
});

export const HighlightEditor: FC<{
  editorState: HighlightEditorState;
  isEnabled: boolean;
  onAcceptForEditing: (isEnabled?: boolean) => void;
  onRetranscribe: (selectedWordIds: number[]) => void;
  onRegenerateBroll?: (selectedWordIds: number[]) => void;
  speakerMap: Record<number, string>;
  onChangeSpeakerMap?: (speakerNumber: number, speakerName: string) => void;
  editorDispatch: Dispatch<HighlightEditorAction>;
}> = ({
  editorState,
  isEnabled,
  speakerMap,
  onRetranscribe,
  onChangeSpeakerMap,
  editorDispatch,
  onRegenerateBroll
}) => {
  const [beforeExtraLines, setBeforeExtraLines] = useState(SHOW_EXTRA_LINES);
  const [afterExtraLines, setAfterExtraLines] = useState(SHOW_EXTRA_LINES);
  const popoverRef = useRef(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { isOpen: isRenamePopupOpen, onOpen: onRenameOpen, onClose } = useDisclosure();
  const [editedSpeaker, setEditedSpeaker] = useState<number>();

  useOutsideClick({
    ref: popoverRef,
    handler: () => {
      setIsPopupOpen(false);
    }
  });

  const [selectionBounds, setSelectionBounds] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [selectedWordIds, setSelectedWordIds] = useState<number[]>([]);

  const { startIndex, endIndex } = editorState;
  const visibleSentences = useMemo(() => {
    return editorState.sentences.filter(
      line => startIndex - beforeExtraLines < line.index && endIndex + afterExtraLines >= line.index
    );
  }, [afterExtraLines, beforeExtraLines, editorState.sentences, endIndex, startIndex]);

  return (
    <>
      {startIndex - beforeExtraLines > 0 && (
        <Button mb={4} size="xs" onClick={() => setBeforeExtraLines(lines => lines + 10)}>
          <FaPlus />
          Show More
        </Button>
      )}
      <Box
        lineHeight={7}
        position="relative"
        onMouseUp={function handleSelection() {
          const selection = window.getSelection();
          if (!selection || !selection.rangeCount) return;
          const range = selection.getRangeAt(0);
          const selectedIds = new Set<string>(); // Using a Set to ensure uniqueness
          if (selection.rangeCount > 0 && selection.type === 'Range') {
            const startNode = range.startContainer;
            const startElement = startNode.parentElement;
            const rect = range.getBoundingClientRect();
            setIsPopupOpen(true);
            setSelectionBounds({
              top: startElement?.offsetTop ?? 0,
              left: (rect.left + rect.width) / 2
            });
          } else {
            setIsPopupOpen(false);
          }

          // Checking direct range startContainer and endContainer
          const startElement =
            range.startContainer.parentNode instanceof HTMLElement ? range.startContainer.parentNode : null;
          const endElement =
            range.endContainer.parentNode instanceof HTMLElement ? range.endContainer.parentNode : null;

          // Add IDs from the direct parent of the start and end containers if they exist
          if (startElement && startElement.getAttribute('data-word-id')) {
            selectedIds.add(startElement.getAttribute('data-word-id')!);
          }
          if (endElement && endElement !== startElement && endElement.getAttribute('data-word-id')) {
            selectedIds.add(endElement.getAttribute('data-word-id')!);
          }
          // Using a TreeWalker to iterate through text nodes in the selection
          const treeWalker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, {
            acceptNode: node => {
              // Only accept nodes that are part of the selection
              return selection.containsNode(node, true) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
          });

          while (treeWalker.nextNode()) {
            const currentNode = treeWalker.currentNode;
            const parentElement = currentNode.parentNode;

            // Ensure the parentNode is an Element, and it contains the data-word-id attribute
            if (parentElement instanceof Element && parentElement.hasAttribute('data-word-id')) {
              const wordId = parentElement.getAttribute('data-word-id');
              if (wordId) {
                selectedIds.add(wordId);
              }
            }
          }
          setSelectedWordIds(Array.from(selectedIds).map(id => parseInt(id)));
        }}
      >
        {isPopupOpen && (
          <Popover placement="top" isOpen={isPopupOpen} autoFocus={false}>
            <PopoverTrigger>
              <Box
                style={{
                  position: 'absolute',
                  zIndex: 10, // Ensure it's above other content
                  left: `${selectionBounds?.left}px`,
                  top: `${selectionBounds?.top - 10}px`
                }}
              />
            </PopoverTrigger>
            <PopoverContent width="auto" bg="black" boxShadow="dark-lg" borderColor="gray.200">
              <Flex flexDirection="column" ref={popoverRef} onMouseUp={e => e.preventDefault()}>
                <EditorPopupMenu
                  editorState={editorState}
                  editorDispatch={editorDispatch}
                  selectedWordIds={selectedWordIds}
                  onRetranscribe={onRetranscribe}
                  onRegenerateBroll={onRegenerateBroll ?? noop}
                  isEnabled={isEnabled}
                  onClose={() => setIsPopupOpen(false)}
                />
              </Flex>
            </PopoverContent>
          </Popover>
        )}
        <Sentences
          sentences={visibleSentences}
          speakerMap={speakerMap}
          onChangeSpeakerMap={onChangeSpeakerMap}
          onRenameOpen={onRenameOpen}
          setEditedSpeaker={setEditedSpeaker}
        />
      </Box>
      {endIndex + afterExtraLines < editorState.sentences.length && (
        <Button mt={4} size="xs" onClick={() => setAfterExtraLines(lines => lines + 10)}>
          <FaPlus />
          Show More
        </Button>
      )}
      {isRenamePopupOpen && editedSpeaker !== undefined && (
        <RenameSpeakerModal
          speakerName={speakerMap[editedSpeaker] ?? `Speaker ${editedSpeaker}`}
          onClose={() => {
            onClose();
            setEditedSpeaker(undefined);
          }}
          onRename={async ({ speakerName }) => {
            await onChangeSpeakerMap?.(editedSpeaker, speakerName);
            onClose();
          }}
        />
      )}
    </>
  );
};
