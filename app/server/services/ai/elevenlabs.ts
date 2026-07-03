import { ElevenLabsClient, Music } from '@elevenlabs/elevenlabs-js';
import { Voice } from '@elevenlabs/elevenlabs-js/api/types';
import { createWriteStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { WordBaseEdited } from '../../types/index';
import { ELEVENLABS_API_KEY } from '../../config/const';

const client = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });
const musicClient = new Music({ apiKey: ELEVENLABS_API_KEY });
export const getElevenLabsVoices = async (): Promise<Voice[]> => {
  const voices = await client.voices.getAll();
  return voices.voices;
};

export const getElevenLabsMusic = async (
  prompt: string,
  musicLengthMs: number,
  outputLocation: string
): Promise<Omit<Awaited<ReturnType<typeof musicClient.composeDetailed>>, 'audio'>> => {
  const music = await musicClient.composeDetailed({
    prompt,
    outputFormat: 'mp3_44100_128',
    musicLengthMs: Math.round(musicLengthMs)
  });

  const fileStream = createWriteStream(outputLocation);

  // Write the audio buffer to file
  fileStream.write(music.audio);
  fileStream.end();

  // Wait for file to be written
  await new Promise<void>((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });

  // Return the music metadata (JSON output) without the audio buffer
  const { audio, ...musicMetadata } = music;
  return musicMetadata;
};

export const generateElevenLabsTTS = async (
  text: string,
  voice: string,
  tmpDir = '/tmp/data'
): Promise<[string, string, WordBaseEdited[]]> => {
  return new Promise<[string, string, WordBaseEdited[]]>(async (resolve, reject) => {
    try {
      const audio = await client.textToSpeech.convertWithTimestamps(voice, {
        modelId: 'eleven_turbo_v2_5',
        text,
        outputFormat: 'mp3_44100_128'
      });
      const fileName = `${uuidv4()}.mp3`;
      const filepath = `${tmpDir}/${fileName}`;
      const fileStream = createWriteStream(filepath);

      // Convert base64 to buffer and write to file
      const audioBuffer = Buffer.from(audio.audioBase64, 'base64');
      fileStream.write(audioBuffer);
      fileStream.end();

      // Create WordBaseEdited array from character timestamps
      const words: WordBaseEdited[] = [];
      let currentWord = '';
      let wordStart = 0;

      if (!audio.alignment) {
        throw new Error('Alignment is undefined');
      }

      for (let i = 0; i < audio.alignment.characters.length; i++) {
        const char = audio.alignment.characters[i];
        const startTime = audio.alignment.characterStartTimesSeconds[i];
        const endTime = audio.alignment.characterEndTimesSeconds[i];

        if (/\s/.test(char) || /[\n\r\u2028\u2029]/.test(char)) {
          if (currentWord) {
            words.push({
              word: currentWord,
              start: wordStart,
              end: endTime,
              confidence: 1,
              isVisible: true,
              punctuated_word: currentWord,
              isParagraphEnd: /[\n\r\u2028\u2029]/.test(char)
            });
            currentWord = '';
          }
        } else {
          if (currentWord === '') {
            wordStart = startTime;
          }
          currentWord += char;
        }
      }

      // Add the last word if exists
      if (currentWord) {
        words.push({
          word: currentWord,
          start: wordStart,
          end: audio.alignment.characterEndTimesSeconds[audio.alignment.characters.length - 1],
          confidence: 1,
          isVisible: true,
          isParagraphEnd: false,
          punctuated_word: currentWord
        });
      }

      fileStream.on('finish', () => resolve([fileName, filepath, words]));
      fileStream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};
