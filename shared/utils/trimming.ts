import { SyncPrerecordedResponse } from '@deepgram/sdk';
import { Sentence, HighlightSegment, WordBaseEdited } from '../types';

export type SentencesAccumulator = {
  sentences: Sentence[];
  currentSentence: Sentence;
  lastSpeaker: number | undefined | null;
};
export const getSentences = (job: SyncPrerecordedResponse) => {
  const sentences = job.results.channels[0].alternatives[0].words.reduce<SentencesAccumulator>(sentencesReducer, {
    sentences: [],
    currentSentence: { content: '', words: [], start: undefined, end: undefined },
    lastSpeaker: null
  });

  return sentences;
};

export const getSentencesFromWords = (words: WordBaseEdited[]) => {
  const sentences = words.reduce<SentencesAccumulator>(sentencesReducer, {
    sentences: [],
    currentSentence: { content: '', words: [], start: undefined, end: undefined },
    lastSpeaker: null
  });

  return sentences;
};

const sentencesReducer = (acc: SentencesAccumulator, item: WordBaseEdited, index: number, arr: WordBaseEdited[]) => {
  if (acc.currentSentence.start === undefined && item.start) {
    acc.currentSentence.start = item.start;
  }
  acc.currentSentence.end = item.end;
  acc.currentSentence.words.push({ ...item, wordIndex: index });
  // Check for speaker change
  const currentSpeaker = item.speaker;
  if (currentSpeaker !== acc.lastSpeaker) {
    if (acc.lastSpeaker !== null) {
      acc.currentSentence.content += `Speaker ${currentSpeaker}:`;
    }
    acc.lastSpeaker = currentSpeaker; // Update the last speaker to the current one
  }
  acc.currentSentence.content += `${item.punctuated_word ?? item.word} `;
  if (
    item.punctuated_word &&
    (item.punctuated_word.indexOf('?') > -1 ||
      item.punctuated_word.indexOf('!') > -1 ||
      item.punctuated_word.indexOf('.') > -1)
  ) {
    acc.sentences.push({
      ...acc.currentSentence,
      content: acc.currentSentence.content.trim()
    });
    acc.currentSentence = { content: '', words: [], start: undefined, end: undefined };
  }
  if (index === arr.length - 1 && acc.currentSentence.content.length > 0) {
    acc.sentences.push({
      ...acc.currentSentence,
      content: acc.currentSentence.content.trim()
    });
  }
  return acc;
};

export const getAdjustedVisibleWords = (validWords: WordBaseEdited[]): WordBaseEdited[] => {
  // Get segments first
  const segments = getSegments(validWords);

  // Initialize the adjusted words array
  let adjustedWords: WordBaseEdited[] = [];

  // Cumulative time for the adjusted video
  let cumulativeTime = 0;

  // Index to track the current segment
  let segmentIndex = 0;

  validWords.forEach(word => {
    if (word.isVisible) {
      while (segmentIndex < segments.length && word.start >= segments[segmentIndex].end) {
        // Move to the next segment if the current word start is beyond the current segment end
        cumulativeTime += segments[segmentIndex].end - segments[segmentIndex].start;
        segmentIndex++;
      }

      if (
        segmentIndex < segments.length &&
        word.start >= segments[segmentIndex].start &&
        word.end <= segments[segmentIndex].end
      ) {
        // Adjust start and end times based on cumulative time
        const adjustedWord: WordBaseEdited = {
          word: word.word,
          speaker: word.speaker,
          speaker_confidence: word.speaker_confidence,
          punctuated_word: word.punctuated_word,
          confidence: word.confidence,
          start: cumulativeTime + (word.start - segments[segmentIndex].start),
          end: cumulativeTime + (word.end - segments[segmentIndex].start)
        };
        adjustedWords.push(adjustedWord);
      }
    }
  });

  return adjustedWords;
};

export const getValidWords = (job: SyncPrerecordedResponse, startIndex: number, endIndex: number) => {
  const sentences = getSentences(job);
  const firstWordIndex = sentences.sentences
    .find((_, index) => index === startIndex)
    ?.words.find(word => !!word.start)?.wordIndex;

  const lastWordIndex = sentences.sentences
    .find((_, index) => index === endIndex)
    ?.words.reverse()
    .find(word => !!word.end)?.wordIndex;
  if (firstWordIndex === undefined || lastWordIndex === undefined) {
    throw 'Words not found.';
  }
  const validWords = job.results.channels[0].alternatives[0].words;

  return validWords;
};

export const getSegments = (validWords: WordBaseEdited[]): HighlightSegment[] => {
  // In case there are no valid words or the array is empty, return an empty array
  if (validWords.length === 0) {
    return [];
  }

  let segments: { start: number; end: number }[] = [];
  let currentSegmentStart: number | null = null;
  let lastVisibleWordEnd: number = 0;

  validWords.forEach((item, index) => {
    // Check if the word is one of the filler words
    if (item.isVisible) {
      // If currentSegmentStart is null, this is the start of a new visible segment
      if (currentSegmentStart === null) {
        currentSegmentStart = item.start;
      }
      lastVisibleWordEnd = item.end;
    } else if (currentSegmentStart !== null) {
      // Encounter an invisible word after starting a segment
      segments.push({
        start: currentSegmentStart,
        end: lastVisibleWordEnd // Use the end time of the last visible word
      });
      currentSegmentStart = null; // Reset currentSegmentStart to signify the end of a continuous visible segment
    }

    // Handle the last word in the array
    if (index === validWords.length - 1 && currentSegmentStart !== null) {
      segments.push({
        start: currentSegmentStart,
        end: lastVisibleWordEnd // For the last word, close the segment here
      });
    }
  });

  return segments;
};
