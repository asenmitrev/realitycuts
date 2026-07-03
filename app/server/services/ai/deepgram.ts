import { createClient } from '@deepgram/sdk';
import { DEEPGRAM_API_KEY } from '../../config/const';
import { WordBaseEdited } from 'shared/types';
import { getEditedWordsList } from '../../utils/get-edited-words';
import { MEDIA_BASE_URL, toInternalMediaUrl } from '../../config/storage';

const deepgram = createClient(DEEPGRAM_API_KEY!);

const transcriptionOptions = (language?: string) => ({
  model: 'nova-2',
  smart_format: true,
  diarize: true,
  paragraphs: true,
  ...(language ? { language: language } : {}),
  detect_language: language === undefined,
  filler_words: true
});

export const transcribeUrl = async (url: string, language?: string): Promise<WordBaseEdited[]> => {
  // Self-hosted media (MinIO on localhost/private hosts) is not reachable from
  // Deepgram's cloud, so send the bytes instead of the URL for our own media.
  if (url.startsWith(`${MEDIA_BASE_URL}/`)) {
    const response = await fetch(toInternalMediaUrl(url));
    if (!response.ok) {
      throw new Error(`Failed to fetch media for transcription: ${response.status} ${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      transcriptionOptions(language)
    );

    if (error) throw error;

    return getEditedWordsList(result);
  }

  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    {
      url
    },
    transcriptionOptions(language)
  );

  if (error) throw error;

  return getEditedWordsList(result);
};
