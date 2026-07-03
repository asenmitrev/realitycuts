import { WordBaseEdited } from '../../../../types';
import { splitText } from '../agents/text-splitting.agent';

export const getSentences = async (transcript: WordBaseEdited[]): Promise<WordBaseEdited[][]> => {
  const script = transcript.map(w => w.punctuated_word ?? w.word).join(' ');

  const textSplitWithSymbols = await splitText(script);

  const chunks = splitIntoChunks(textSplitWithSymbols);
  const matchedChunks = matchWordsToChunks(transcript, script, chunks);

  const longEnoughChunks: WordBaseEdited[][] = [];
  for (let i = 0; i < matchedChunks.length; i++) {
    const chunk = matchedChunks[i];
    const chunkLength = (chunk[chunk.length - 1]?.end ?? 0) - (chunk[0]?.start ?? 0);
    if (chunkLength > 2 || !matchedChunks[i + 1]) {
      longEnoughChunks.push(chunk);
    } else {
      matchedChunks[i + 1] = [...chunk, ...matchedChunks[i + 1]];
    }
  }
  const output: WordBaseEdited[][] = [];

  for (const chunk of longEnoughChunks) {
    const chunkLength = (chunk[chunk.length - 1]?.end ?? 0) - (chunk[0]?.start ?? 0);
    if (chunkLength > 5) {
      const maxDuration = 4;
      const numPieces = Math.ceil(chunkLength / maxDuration);
      const pieceLength = chunkLength / numPieces;

      let startIndex = 0;
      for (let i = 0; i < numPieces; i++) {
        const targetEnd = chunk[0].start + (i + 1) * pieceLength;
        const endIndex = chunk.findIndex(w => (w.end ?? 0) > targetEnd);
        const piece = chunk.slice(startIndex, endIndex === -1 ? chunk.length : endIndex);
        if (piece.length > 0) {
          output.push(piece);
        }
        startIndex = endIndex;
      }
    } else {
      output.push(chunk);
    }
  }

  return output.filter(chunk => chunk.length > 0);
};

function normalizeText(text: string): string {
  // Remove punctuation and convert to lowercase
  // Use Unicode property escapes to match all letters and digits, not just ASCII
  return text.replace(/[^\p{L}\p{N}\s]/gu, '').toLowerCase();
}

function splitIntoChunks(paragraph: string): string[] {
  // Split the paragraph by the | symbol
  return paragraph.split('|').map(chunk => chunk.trim());
}

function matchWordsToChunks(transcript: WordBaseEdited[], textOnly: string, chunks: string[]): WordBaseEdited[][] {
  const normalizedChunks = chunks.map(normalizeText);
  const normalizedTextOnly = normalizeText(textOnly);
  const words = normalizedTextOnly.split(/\s+/);

  const result: WordBaseEdited[][] = Array.from({ length: chunks.length }, () => []);
  let currentChunkIndex = 0;
  let currentChunkWords = normalizedChunks[currentChunkIndex].split(/\s+/);
  let currentChunkWordIndex = 0;
  let transcriptIndex = 0;

  for (const word of words) {
    if (currentChunkWordIndex >= currentChunkWords.length) {
      currentChunkIndex++;
      if (currentChunkIndex >= normalizedChunks.length) break;
      currentChunkWords = normalizedChunks[currentChunkIndex].split(/\s+/);
      currentChunkWordIndex = 0;
    }

    if (word === currentChunkWords[currentChunkWordIndex]) {
      if (transcriptIndex < transcript.length) {
        result[currentChunkIndex].push(transcript[transcriptIndex]);
        transcriptIndex++;
      }
      currentChunkWordIndex++;
    } else {
      // Handle potential mismatches (e.g., due to inaccuracies)
      if (transcriptIndex < transcript.length) {
        result[currentChunkIndex].push(transcript[transcriptIndex]);
        transcriptIndex++;
      }
    }
  }

  return result;
}
