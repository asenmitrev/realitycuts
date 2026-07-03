import { OpenAI } from 'openai';
import fs from 'fs';
import { TTSVoiceType } from '../../types';
import { OPENAI_KEY, OPENAI_BASE_URL } from '../../config/const';

export const AIClient = new OpenAI({
  apiKey: OPENAI_KEY,
  baseURL: OPENAI_BASE_URL || 'https://api.openai.com/v1'
});

export async function getEmbeddings(input: string) {
  return new Promise<number[]>((resolve, reject) => {
    let isResolved = false;

    const timeout = setTimeout(() => {
      // Catch openai api sometimes not responding
      if (!isResolved) {
        isResolved = true;
        reject('OpenAI has timed out');
      }
    }, 100 * 1000);

    AIClient.embeddings
      .create(
        {
          model: 'text-embedding-3-small',
          input,
          encoding_format: 'float'
        },
        { timeout: 100 * 1000 }
      )
      .then(response => {
        resolve(response.data[0].embedding);
      })
      .catch(error => {
        reject(error);
      })
      .finally(() => {
        isResolved = true;
        clearTimeout(timeout);
      });
  });
}

export async function generateTTS(
  input: string,
  voice: TTSVoiceType = 'alloy',
  tmpDir = '/tmp/data'
): Promise<[string, string]> {
  if (input.length > 4096) {
    throw new Error(
      'The input is too long. Maximum supported length is 4096 characters. This restriction will be lifted in the future.'
    );
  }
  const mp3 = await AIClient.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice,
    input
  });

  const filename = `${Date.now()}.mp3`;
  const outputAudioPath = `${tmpDir}/${filename}`;
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.promises.writeFile(outputAudioPath, buffer);
  return [filename, outputAudioPath];
}
