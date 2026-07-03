import { WordBaseEdited } from '../../../../types/video-ai-data';

export const getContextForSentence = (transcript: WordBaseEdited[], startTime: number, desiredEndTime: number) => {
  // Find the start index: either 0 or the last isParagraphEnd===true word before startTime
  let startIndex = 0;
  for (let i = transcript.findIndex(w => w.end >= startTime) - 1; i >= 0; i--) {
    if (transcript[i].isParagraphEnd) {
      startIndex = i + 1; // Start from the word after the paragraph end
      break;
    }
  }

  // Find the end index: either the end of transcript or the first isParagraphEnd===true word after desiredEndTime
  let endIndex = transcript.length - 1;
  const firstWordAfterEndIndex = transcript.findIndex(w => w.start >= desiredEndTime);
  if (firstWordAfterEndIndex !== -1) {
    for (let i = firstWordAfterEndIndex; i < transcript.length; i++) {
      if (transcript[i].isParagraphEnd) {
        endIndex = i;
        break;
      }
    }
  }

  // Get the words in the context range
  const words = transcript.slice(startIndex, endIndex + 1);
  return words.map(w => w.punctuated_word ?? w.word).join(' ');
};
