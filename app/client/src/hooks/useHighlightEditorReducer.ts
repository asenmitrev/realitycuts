import { useReducer } from 'react';
import { getSentencesFromWords } from 'shared/utils/trimming';
import type { Reducer } from 'react';
import type { HighlightEditorAction, HighlightEditorState, WordBaseEdited } from '../types';

export const initializeHighlightEditorState = (tspt: WordBaseEdited[]): HighlightEditorState => {
  const sentencesReduced = getSentencesFromWords(tspt);
  let startIndex = sentencesReduced.sentences.length - 1;
  let endIndex = 0;

  const sentences = sentencesReduced.sentences.map((sentence, index) => {
    const isVisible = sentence.words.some(word => word.isVisible);
    if (isVisible) {
      if (startIndex > index) {
        startIndex = index;
      }
      if (endIndex < index) {
        endIndex = index;
      }
    }
    return {
      ...sentence,
      index,
      isVisible: isVisible
    };
  });
  return {
    sentences,
    startIndex,
    endIndex,
    isDirty: false
  };
};

export const highlightEditorReducer: Reducer<HighlightEditorState, HighlightEditorAction> = (state, action) => {
  if (action.type === 'RESET') {
    return initializeHighlightEditorState(action.payload.transcript);
  }
  if (action.type === 'SET_DIRTY') {
    return {
      ...state,
      isDirty: action.payload.isDirty
    };
  }
  if (action.type === 'SET_SENTENCE_VISIBILITY') {
    const sentence = action.payload.sentence;
    const isVisible = action.payload.isVisible;
    const sentences = state.sentences.map(s => {
      return s === sentence
        ? {
            ...s,
            isVisible,
            words: s.words.map(w => {
              const isFillerWord = ['uh', 'uhm', 'ah', 'um'].includes(w.word.toLowerCase());
              return { ...w, isVisible: isVisible === true ? !isFillerWord : isVisible };
            })
          }
        : s;
    });
    const { startIndex, endIndex } = sentences.reduce(
      (acc, item, index) => {
        const firstVisibleWord = item.words.find(word => word.isVisible);
        if (!firstVisibleWord) return acc;
        if (acc.startIndex === 0) {
          acc.startIndex = index;
        }
        acc.endIndex = index;
        return acc;
      },
      { startIndex: 0, endIndex: 0 }
    );

    return {
      ...state,
      startIndex,
      endIndex,
      sentences,
      isDirty: true
    };
  } else if (action.type === 'SET_WORD_VISIBILITY') {
    const sentence = action.payload.sentence;
    const word = action.payload.word;
    const isVisible = action.payload.isVisible;
    const sentences = state.sentences.map(s => {
      if (s === sentence) {
        return {
          ...s,
          words: s.words.map(w => {
            return w === word ? { ...w, isVisible } : w;
          })
        };
      } else {
        return s;
      }
    });
    const { startIndex, endIndex } = sentences.reduce(
      (acc, item, index) => {
        const firstVisibleWord = item.words.find(word => word.isVisible);
        if (!firstVisibleWord) return acc;
        if (acc.startIndex === 0) {
          acc.startIndex = index;
        }
        acc.endIndex = index;
        return acc;
      },
      { startIndex: 0, endIndex: 0 }
    );
    return {
      ...state,
      startIndex,
      endIndex,
      sentences,
      isDirty: true
    };
  } else if (action.type === 'CHANGE_WORDS_VISIBILITY') {
    const wordIds = action.payload.wordIds as number[];
    const isVisible = action.payload.isVisible as boolean;
    const sentences = state.sentences.map(s => {
      return {
        ...s,
        words: s.words.map(w => {
          return typeof w.wordIndex === 'number' && wordIds.indexOf(w.wordIndex) > -1 ? { ...w, isVisible } : w;
        })
      };
    });
    const { startIndex, endIndex } = sentences.reduce(
      (acc, item, index) => {
        const firstVisibleWord = item.words.find(word => word.isVisible);
        if (!firstVisibleWord) return acc;
        if (acc.startIndex === 0) {
          acc.startIndex = index;
        }
        acc.endIndex = index;
        return acc;
      },
      { startIndex: 0, endIndex: 0 }
    );
    return {
      ...state,
      sentences,
      startIndex,
      endIndex,
      isDirty: true
    };
  } else if (action.type === 'REMOVE_FILLER_WORDS') {
    const wordIds = action.payload.wordIds;
    const sentences = state.sentences.map(s => {
      return {
        ...s,
        words: s.words.map(w => {
          const isFillerWord = ['uh', 'uhm', 'ah', 'um'].includes(w.word.toLowerCase());
          return typeof w.wordIndex === 'number' && wordIds.indexOf(w.wordIndex) > -1
            ? { ...w, isVisible: w.isVisible === true ? !isFillerWord : w.isVisible }
            : w;
        })
      };
    });
    const { startIndex, endIndex } = sentences.reduce(
      (acc, item, index) => {
        const firstVisibleWord = item.words.find(word => word.isVisible);
        if (!firstVisibleWord) return acc;
        if (acc.startIndex === 0) {
          acc.startIndex = index;
        }
        acc.endIndex = index;
        return acc;
      },
      { startIndex: 0, endIndex: 0 }
    );
    return {
      ...state,
      startIndex,
      endIndex,
      sentences,
      isDirty: true
    };
  } else if (action.type === 'REPLACE_WORDS') {
    const editedWordsList = action.payload.transcript;
    const startTime = action.payload.startTime;
    const endTime = action.payload.endTime;
    // Find the start and end indices for the portion to be replaced
    const startIndex = editedWordsList.findIndex(item => item.start >= startTime);
    const endIndex = editedWordsList.findIndex(item => item.end > endTime);

    // If startIndex or endIndex is -1, it means the interval is out of the array bounds
    const validStartIndex = startIndex !== -1 ? startIndex : editedWordsList.length;
    const validEndIndex = endIndex !== -1 ? endIndex : editedWordsList.length;

    const oldWords = editedWordsList.slice(validStartIndex, validEndIndex);

    const speakerMap: number[] = [];

    oldWords.forEach(word => {
      if (typeof word.speaker !== 'undefined' && speakerMap.indexOf(word.speaker) === -1) {
        speakerMap.push(word.speaker);
      }
    });
    const newWords = action.payload.words.map(word => {
      return {
        ...word,
        isVisible: true,
        speaker: typeof word.speaker === 'number' ? speakerMap[word.speaker] : undefined
      };
    });
    // Create the new array with the replacement
    const reworkedTranscript = [
      ...editedWordsList.slice(0, validStartIndex),
      ...newWords,
      ...editedWordsList.slice(validEndIndex)
    ];

    return initializeHighlightEditorState(reworkedTranscript);
  } else if (action.type === 'CHANGE_WORD_TIMING') {
    const wordIndex = action.payload.wordIndex;
    const start = action.payload.start;
    const end = action.payload.end;
    const sentences = state.sentences.map(s => {
      return {
        ...s,
        words: s.words.map(w => {
          return wordIndex === w.wordIndex ? { ...w, start, end } : w;
        })
      };
    });
    const { startIndex, endIndex } = sentences.reduce(
      (acc, item, index) => {
        const firstVisibleWord = item.words.find(word => word.isVisible);
        if (!firstVisibleWord) return acc;
        if (acc.startIndex === 0) {
          acc.startIndex = index;
        }
        acc.endIndex = index;
        return acc;
      },
      { startIndex: 0, endIndex: 0 }
    );
    return {
      ...state,
      startIndex,
      endIndex,
      sentences,
      isDirty: true
    };
  } else if (action.type === 'CHANGE_WORD_SPELLING') {
    const wordIndex = action.payload.wordIndex;
    const word = action.payload.word;
    const sentences = state.sentences.map(s => {
      return {
        ...s,
        words: s.words.map(w => {
          return wordIndex === w.wordIndex ? { ...w, punctuated_word: word } : w;
        })
      };
    });
    const { startIndex, endIndex } = sentences.reduce(
      (acc, item, index) => {
        const firstVisibleWord = item.words.find(word => word.isVisible);
        if (!firstVisibleWord) return acc;
        if (acc.startIndex === 0) {
          acc.startIndex = index;
        }
        acc.endIndex = index;
        return acc;
      },
      { startIndex: 0, endIndex: 0 }
    );
    return {
      ...state,
      startIndex,
      endIndex,
      sentences,
      isDirty: true
    };
  }
  return state;
};

export const useHighlightEditorReducer = ({ transcript }: { transcript: WordBaseEdited[] }) => {
  return useReducer<
    Reducer<HighlightEditorState, HighlightEditorAction>,
    {
      transcript: WordBaseEdited[];
    }
  >(
    highlightEditorReducer,
    {
      transcript
    },
    ({ transcript }) => initializeHighlightEditorState(transcript)
  );
};
