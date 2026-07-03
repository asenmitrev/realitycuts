import { generateElevenLabsTTS } from './ai/elevenlabs';
import { concatenateAudioFiles } from './video-manipulation/ffmpeg';
import { TTSVoiceType, WordBaseEdited } from 'shared/types';
import { generateTTS } from './ai/openai';
import { safelyDelete } from './fs';
import { retry } from '../utils/retry-fn';
import { logger } from './logging';

export async function generateVoiceover(
  script: string,
  isVoicePremium: boolean,
  voiceType: string,
  tmpDir = '/tmp/data'
) {
  let audioName = `${new Date().getTime()}.mp3`;
  let audioPath = `${tmpDir}/${audioName}`;
  const scriptWords = script.split(' ');
  const audioPaths: string[] = [];
  const transcripts: WordBaseEdited[][] = [];

  let currentChunk = '';
  const chunks: string[] = [];

  while (scriptWords.length > 0) {
    const nextWord = scriptWords[0];
    const nextChunk = currentChunk + (currentChunk ? ' ' : '') + nextWord;

    // Check if adding next word would exceed limit
    if (nextChunk.length > 3800) {
      // Leave some buffer
      // Only process current chunk if it ends with sentence-ending punctuation
      if (currentChunk.match(/[.!?]$/)) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
    }

    // Add next word to chunk
    currentChunk += (currentChunk ? ' ' : '') + scriptWords.shift();
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }
  try {
    for (const chunk of chunks) {
      if (
        isVoicePremium ||
        !['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'ash', 'ballad', 'coral', 'sage', 'verse'].includes(
          voiceType
        )
      ) {
        const [partAudioName, partAudioPath, transcript] = await retry(
          () => generateElevenLabsTTS(chunk, voiceType, tmpDir),
          {
            maxAttempts: 3,
            delayMs: 1000,
            onRetry: (error, attempt) => {
              logger.error('Error generating TTS', {
                Error: error,
                Chunk: chunk,
                'Voice Type': voiceType,
                Attempt: attempt
              });
            }
          }
        );
        audioPaths.push(partAudioPath);
        transcripts.push(transcript);
      } else {
        const [partAudioName, partAudioPath] = await retry(
          () => generateTTS(chunk, voiceType as TTSVoiceType | undefined, tmpDir),
          {
            maxAttempts: 3,
            delayMs: 1000,
            onRetry: (error, attempt) => {
              logger.error('Error generating TTS', {
                Error: error,
                Chunk: chunk,
                'Voice Type': voiceType,
                Attempt: attempt
              });
            }
          }
        );
        audioPaths.push(partAudioPath);
      }
    }

    await concatenateAudioFiles(audioPaths, audioPath);

    let transcript: WordBaseEdited[] = [];
    if (isVoicePremium) {
      transcript = concatenateTranscripts(transcripts);
    }
    return { audioPath, audioName, transcript };
  } finally {
    for (const audioPath of audioPaths) {
      safelyDelete(audioPath);
    }
  }
}

export const concatenateTranscripts = (transcripts: WordBaseEdited[][]): WordBaseEdited[] => {
  const concatenatedTranscripts: WordBaseEdited[] = [];
  let timeOffset = 0;

  for (const transcript of transcripts) {
    // Adjust timestamps by adding the time offset
    const adjustedTranscript = transcript.map(word => ({
      ...word,
      start: word.start + timeOffset,
      end: word.end + timeOffset
    }));

    concatenatedTranscripts.push(...adjustedTranscript);

    // Update time offset for next transcript
    if (transcript.length > 0) {
      const lastWord = transcript[transcript.length - 1];
      timeOffset += lastWord.end;
    }
  }

  return concatenatedTranscripts;
};
