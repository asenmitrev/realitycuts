import { FC, useState } from 'react';
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  Text,
  DrawerFooter,
  DrawerHeader,
  Input,
  Flex,
  Popover,
  PopoverContent,
  PopoverTrigger,
  InputGroup
} from '@chakra-ui/react';
import { Line, WordBase } from '../../types';

const WordEditor: FC<{ word: WordBase; onSave: (word: WordBase) => void }> = ({ word, onSave }) => {
  const [editedWord, setEditedWord] = useState(word.punctuated_word);
  return (
    <Popover placement="top" returnFocusOnClose={false} closeOnEsc={true}>
      <PopoverTrigger>
        <Text as="span" fontSize="lg" cursor="pointer">
          {editedWord ?? word.punctuated_word ?? word.word}{' '}
        </Text>
      </PopoverTrigger>
      <PopoverContent width="auto">
        <Flex flexDirection="row" gap={1} alignItems="center">
          <InputGroup size="sm">
            <Input
              display="inline-block"
              width="auto"
              px={2}
              py={1}
              onChange={e => {
                onSave({
                  ...word,
                  punctuated_word: e.target.value
                });
                setEditedWord(e.target.value);
              }}
              value={editedWord}
            />
          </InputGroup>
        </Flex>
      </PopoverContent>
    </Popover>
  );
};

export interface EditSingleCaptionModalProps {
  isOpen: boolean;
  caption: Line;
  onClose: () => void;
  onSave: (word: WordBase) => void;
}

export const EditSingleCaptionModal: FC<EditSingleCaptionModalProps> = ({ caption, isOpen, onSave, onClose }) => {
  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="xs">
      <DrawerContent bg="black" borderLeft="1px solid" borderColor="gray.200">
        <DrawerCloseButton />
        <DrawerHeader>Edit caption</DrawerHeader>

        <DrawerBody>
          <Text fontSize="xs" color="gray.200" mb={4}>
            Please click on a word below to edit it.
          </Text>
          {caption.content.map(word => (
            <WordEditor word={word} key={word.start} onSave={onSave} />
          ))}
        </DrawerBody>

        <DrawerFooter>
          <Button mr={4} variant="outline" onClick={onClose} type="button">
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
