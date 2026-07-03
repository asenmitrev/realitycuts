import { TranscriptionLineJson, WordBaseEdited } from '../types';
import { getSentences, getSentencesFromWords } from 'shared/utils/trimming';
import { SyncPrerecordedResponse } from '@deepgram/sdk';

export function formatTranscriptionWords(words: WordBaseEdited[], skipTimestamps = false) {
  const sentences = getSentencesFromWords(words);
  const string = sentences.sentences.reduce((acc, item, index) => {
    if (skipTimestamps) {
      acc += `${index}: ${item.content}\n`;
    } else {
      acc += `${secondsToTimestamp(item.start ?? 0)} -> ${secondsToTimestamp(item.end ?? 0)}: ${item.content}\n`;
    }
    return acc;
  }, '');

  return string;
}
export function formatTranscriptionJob(job: SyncPrerecordedResponse, skipTimestamps = false) {
  const sentences = getSentences(job);
  const string = sentences.sentences.reduce((acc, item, index) => {
    if (skipTimestamps) {
      acc += `${index}: ${item.content}\n`;
    } else {
      acc += `${secondsToTimestamp(item.start ?? 0)} -> ${secondsToTimestamp(item.end ?? 0)}: ${item.content}\n`;
    }
    return acc;
  }, '');

  return string;
}

export function formatTranscriptionJobJson(job: SyncPrerecordedResponse) {
  const sentences = getSentences(job);
  return sentences.sentences.reduce((acc, item, index) => {
    acc.push({
      content: item.content,
      index,
      timeStart: item.start,
      words: item.words,
      timeEnd: item.end
    });
    return acc;
  }, [] as TranscriptionLineJson[]);
}
export function secondsToTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  // Use Math.round to handle floating point precision issues, then ensure we get 3 digits
  const milliseconds = Math.round((seconds - Math.floor(seconds)) * 1000);

  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
  // Use padStart to ensure 3 digits (e.g., 50 -> 050, not 500)
  const formattedMilliseconds = milliseconds.toString().padStart(3, '0');

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`;
}
