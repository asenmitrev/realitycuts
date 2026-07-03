import { useMemo } from 'react';
import { HighlightEditorState, WordBaseEdited } from '../types';

export const useEditedWords = (editedWordsList: WordBaseEdited[], editorState: HighlightEditorState) => {
  const editedWords = useMemo(
    () =>
      (editedWordsList ?? []).map((word, index) => {
        for (const sentence of editorState.sentences) {
          const wordFound = sentence.words.find(w => w.wordIndex === index);
          if (wordFound) {
            return {
              ...word,
              wordIndex: wordFound.wordIndex,
              punctuated_word: wordFound.punctuated_word,
              start: wordFound.start,
              end: wordFound.end,
              isVisible: wordFound?.isVisible
            };
          }
        }
        return word;
      }),
    [editorState, editedWordsList]
  );
  return editedWords;
};
