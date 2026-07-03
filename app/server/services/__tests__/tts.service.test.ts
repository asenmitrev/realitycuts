import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { generateVoiceover, concatenateTranscripts } from '../tts';
import { generateElevenLabsTTS } from '../ai/elevenlabs';
import { generateTTS } from '../ai/openai';
import { concatenateAudioFiles } from '../video-manipulation/ffmpeg';
import { safelyDelete } from '../fs';
import { WordBaseEdited } from 'shared/types';

// Mock dependencies
vi.mock('../ai/elevenlabs', () => ({
  generateElevenLabsTTS: vi.fn()
}));

vi.mock('../ai/openai', () => ({
  generateTTS: vi.fn()
}));

vi.mock('../video-manipulation/ffmpeg', () => ({
  concatenateAudioFiles: vi.fn()
}));

vi.mock('../fs', () => ({
  safelyDelete: vi.fn()
}));

vi.mock('../../utils/retry-fn', () => ({
  retry: vi.fn(fn => fn())
}));

vi.mock('../logging', () => ({
  logger: {
    error: vi.fn()
  }
}));

describe('TTSService', () => {
  const mockTmpDir = '/tmp/test';
  const mockTranscript: WordBaseEdited[] = [
    { word: 'test', start: 0, end: 0.5, punctuated_word: 'test', confidence: 1 },
    { word: 'word', start: 0.5, end: 1.0, punctuated_word: 'word', confidence: 1 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateVoiceover', () => {
    it('should generate voiceover with premium voice using ElevenLabs', async () => {
      const script = 'Test script';
      const mockAudioName = 'audio1.mp3';
      const mockAudioPath = `${mockTmpDir}/${mockAudioName}`;
      (generateElevenLabsTTS as Mock).mockResolvedValue([mockAudioName, mockAudioPath, mockTranscript]);
      (concatenateAudioFiles as Mock).mockResolvedValue(undefined);

      const result = await generateVoiceover(script, true, 'premium-voice', mockTmpDir);

      expect(generateElevenLabsTTS).toHaveBeenCalled();
      expect(concatenateAudioFiles).toHaveBeenCalled();
      expect(result).toHaveProperty('audioPath');
      expect(result).toHaveProperty('audioName');
      expect(result).toHaveProperty('transcript');
    });

    it('should generate voiceover with non-premium OpenAI voice', async () => {
      const script = 'Test script';
      const mockAudioName = 'audio1.mp3';
      const mockAudioPath = `${mockTmpDir}/${mockAudioName}`;
      (generateTTS as Mock).mockResolvedValue([mockAudioName, mockAudioPath]);
      (concatenateAudioFiles as Mock).mockResolvedValue(undefined);

      const result = await generateVoiceover(script, false, 'alloy', mockTmpDir);

      expect(generateTTS).toHaveBeenCalled();
      expect(generateElevenLabsTTS).not.toHaveBeenCalled();
      expect(result).toHaveProperty('audioPath');
      expect(result).toHaveProperty('audioName');
    });

    it('should split long scripts into chunks', async () => {
      const longScript = Array.from({ length: 500 }, () => 'This is a mock sentence.').join(' '); // ~5000 characters
      const mockAudioName = 'audio1.mp3';
      const mockAudioPath = `${mockTmpDir}/${mockAudioName}`;
      (generateElevenLabsTTS as Mock).mockResolvedValue([mockAudioName, mockAudioPath, mockTranscript]);
      (concatenateAudioFiles as Mock).mockResolvedValue(undefined);

      await generateVoiceover(longScript, true, 'premium-voice', mockTmpDir);

      expect(generateElevenLabsTTS).toHaveBeenCalledTimes(4);
      expect((generateElevenLabsTTS as Mock).mock.calls.length).toBeGreaterThan(1);
    });

    it('should clean up temporary audio files', async () => {
      const script = 'Test script';
      const mockAudioName = 'audio1.mp3';
      const mockAudioPath = `${mockTmpDir}/${mockAudioName}`;
      (generateElevenLabsTTS as Mock).mockResolvedValue([mockAudioName, mockAudioPath, mockTranscript]);
      (concatenateAudioFiles as Mock).mockResolvedValue(undefined);

      await generateVoiceover(script, true, 'premium-voice', mockTmpDir);

      expect(safelyDelete).toHaveBeenCalledWith(mockAudioPath);
    });

    it('should use ElevenLabs for non-standard voice types even when not premium', async () => {
      const script = 'Test script';
      const mockAudioName = 'audio1.mp3';
      const mockAudioPath = `${mockTmpDir}/${mockAudioName}`;
      (generateElevenLabsTTS as Mock).mockResolvedValue([mockAudioName, mockAudioPath, mockTranscript]);
      (concatenateAudioFiles as Mock).mockResolvedValue(undefined);

      await generateVoiceover(script, false, 'custom-voice', mockTmpDir);

      expect(generateElevenLabsTTS).toHaveBeenCalled();
      expect(generateTTS).not.toHaveBeenCalled();
    });
  });

  describe('concatenateTranscripts', () => {
    it('should concatenate transcripts with adjusted timestamps', () => {
      const transcript1: WordBaseEdited[] = [
        { word: 'first', start: 0, end: 0.5, punctuated_word: 'first', confidence: 1 },
        { word: 'word', start: 0.5, end: 1.0, punctuated_word: 'word', confidence: 1 }
      ];
      const transcript2: WordBaseEdited[] = [
        { word: 'second', start: 0, end: 0.5, punctuated_word: 'second', confidence: 1 },
        { word: 'word', start: 0.5, end: 1.0, punctuated_word: 'word', confidence: 1 }
      ];

      const result = concatenateTranscripts([transcript1, transcript2]);

      expect(result).toHaveLength(4);
      expect(result[0].start).toBe(0);
      expect(result[0].end).toBe(0.5);
      expect(result[2].start).toBe(1.0); // Adjusted by first transcript's end time
      expect(result[2].end).toBe(1.5);
    });

    it('should handle empty transcripts array', () => {
      const result = concatenateTranscripts([]);
      expect(result).toEqual([]);
    });

    it('should handle single transcript', () => {
      const transcript: WordBaseEdited[] = [
        { word: 'test', start: 0, end: 1.0, punctuated_word: 'test', confidence: 1 }
      ];

      const result = concatenateTranscripts([transcript]);

      expect(result).toEqual(transcript);
    });

    it('should handle empty transcript in array', () => {
      const transcript1: WordBaseEdited[] = [
        { word: 'first', start: 0, end: 1.0, punctuated_word: 'first', confidence: 1 }
      ];
      const transcript2: WordBaseEdited[] = [];

      const result = concatenateTranscripts([transcript1, transcript2]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(transcript1[0]);
    });
  });
});
