import { SyncPrerecordedResponse } from '@deepgram/sdk';

export function getEditedWordsList(transcript: SyncPrerecordedResponse): any {
  const paragraphs = transcript.results.channels[0].alternatives[0].paragraphs;
  const words = transcript.results.channels[0].alternatives[0].words;

  return words.map(w => {
    const isParagraphEnd = paragraphs?.paragraphs.some(p => p.end === w.end);
    return {
      ...w,
      isVisible: true,
      isParagraphEnd
    };
  });
}
