import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatTranscriptionWords,
  formatTranscriptionJob,
  formatTranscriptionJobJson,
  secondsToTimestamp
} from '../formatter';
import { WordBaseEdited } from '../../types';
import { SyncPrerecordedResponse } from '@deepgram/sdk';

// Mock the shared utilities
vi.mock('shared/utils/trimming', () => ({
  getSentencesFromWords: vi.fn(),
  getSentences: vi.fn()
}));

import { getSentencesFromWords, getSentences, SentencesAccumulator } from 'shared/utils/trimming';

describe('formatter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('secondsToTimestamp', () => {
    it('should format zero seconds correctly', () => {
      expect(secondsToTimestamp(0)).toBe('00:00:00.000');
    });

    it('should format seconds less than a minute', () => {
      expect(secondsToTimestamp(5.123)).toBe('00:00:05.123');
    });

    it('should format minutes correctly', () => {
      expect(secondsToTimestamp(65.456)).toBe('00:01:05.456');
    });

    it('should format hours correctly', () => {
      expect(secondsToTimestamp(3665.789)).toBe('01:01:05.789');
    });

    it('should handle milliseconds correctly', () => {
      expect(secondsToTimestamp(1.1)).toBe('00:00:01.100');
      expect(secondsToTimestamp(1.12)).toBe('00:00:01.120');
      expect(secondsToTimestamp(1.123)).toBe('00:00:01.123');
    });

    it('should pad hours, minutes, and seconds with zeros', () => {
      expect(secondsToTimestamp(1)).toBe('00:00:01.000');
      expect(secondsToTimestamp(61)).toBe('00:01:01.000');
      expect(secondsToTimestamp(3601)).toBe('01:00:01.000');
    });

    it('should handle fractional seconds', () => {
      expect(secondsToTimestamp(0.5)).toBe('00:00:00.500');
      expect(secondsToTimestamp(0.05)).toBe('00:00:00.050');
      expect(secondsToTimestamp(0.005)).toBe('00:00:00.005');
    });

    it('should handle large values', () => {
      expect(secondsToTimestamp(36661.999)).toBe('10:11:01.999');
    });
  });

  describe('formatTranscriptionWords', () => {
    const mockWords: WordBaseEdited[] = [
      {
        word: 'Hello',
        start: 0.5,
        end: 0.8,
        confidence: 0.95,
        punctuated_word: 'Hello'
      },
      {
        word: 'world',
        start: 0.8,
        end: 1.2,
        confidence: 0.92,
        punctuated_word: 'world.'
      }
    ];

    it('should format words with timestamps', () => {
      const mockSentences: SentencesAccumulator = {
        currentSentence: { content: '', words: [], start: undefined, end: undefined },
        lastSpeaker: null,
        sentences: [
          {
            content: 'Hello world.',
            words: mockWords,
            start: 0.5,
            end: 1.2
          }
        ]
      };

      vi.mocked(getSentencesFromWords).mockReturnValue(mockSentences);

      const result = formatTranscriptionWords(mockWords);

      expect(result).toContain('00:00:00.500 -> 00:00:01.200: Hello world.');
      expect(getSentencesFromWords).toHaveBeenCalledWith(mockWords);
    });

    it('should format words without timestamps when skipTimestamps is true', () => {
      const mockSentences: SentencesAccumulator = {
        currentSentence: { content: '', words: [], start: undefined, end: undefined },
        lastSpeaker: null,
        sentences: [
          {
            content: 'Hello world.',
            words: mockWords,
            start: 0.5,
            end: 1.2
          }
        ]
      };

      vi.mocked(getSentencesFromWords).mockReturnValue(mockSentences);

      const result = formatTranscriptionWords(mockWords, true);

      expect(result).toBe('0: Hello world.\n');
      expect(result).not.toContain('00:00:00');
    });

    it('should handle multiple sentences', () => {
      const mockSentences: SentencesAccumulator = {
        currentSentence: { content: '', words: [], start: undefined, end: undefined },
        lastSpeaker: null,
        sentences: [
          {
            content: 'First sentence.',
            words: mockWords,
            start: 0.5,
            end: 1.2
          },
          {
            content: 'Second sentence.',
            words: mockWords,
            start: 2.0,
            end: 3.5
          }
        ]
      };

      vi.mocked(getSentencesFromWords).mockReturnValue(mockSentences);

      const result = formatTranscriptionWords(mockWords);

      expect(result).toContain('00:00:00.500 -> 00:00:01.200: First sentence.');
      expect(result).toContain('00:00:02.000 -> 00:00:03.500: Second sentence.');
    });

    it('should handle undefined start and end times', () => {
      const mockSentences: SentencesAccumulator = {
        currentSentence: { content: '', words: [], start: undefined, end: undefined },
        lastSpeaker: null,
        sentences: [
          {
            content: 'Test',
            words: mockWords,
            start: undefined,
            end: undefined
          }
        ]
      };

      vi.mocked(getSentencesFromWords).mockReturnValue(mockSentences);

      const result = formatTranscriptionWords(mockWords);

      expect(result).toContain('00:00:00.000 -> 00:00:00.000: Test');
    });
  });

  describe('formatTranscriptionJob', () => {
    const mockJob = {
      results: {
        channels: [
          {
            alternatives: [
              {
                words: []
              }
            ]
          }
        ]
      }
    } as unknown as Partial<SyncPrerecordedResponse>;

    it('should format job with timestamps', () => {
      const mockSentences: SentencesAccumulator = {
        currentSentence: { content: '', words: [], start: undefined, end: undefined },
        lastSpeaker: null,
        sentences: [
          {
            content: 'Hello world.',
            words: [],
            start: 0.5,
            end: 1.2
          }
        ]
      };

      vi.mocked(getSentences).mockReturnValue(mockSentences);

      const result = formatTranscriptionJob(mockJob as SyncPrerecordedResponse);

      expect(result).toContain('00:00:00.500 -> 00:00:01.200: Hello world.');
      expect(getSentences).toHaveBeenCalledWith(mockJob);
    });

    it('should format job without timestamps when skipTimestamps is true', () => {
      const mockSentences: SentencesAccumulator = {
        currentSentence: { content: '', words: [], start: undefined, end: undefined },
        lastSpeaker: null,
        sentences: [
          {
            content: 'Hello world.',
            words: [],
            start: 0.5,
            end: 1.2
          }
        ]
      };

      vi.mocked(getSentences).mockReturnValue(mockSentences);

      const result = formatTranscriptionJob(mockJob as SyncPrerecordedResponse, true);

      expect(result).toBe('0: Hello world.\n');
    });

    it('should handle multiple sentences', () => {
      const mockSentences: SentencesAccumulator = {
        currentSentence: { content: '', words: [], start: undefined, end: undefined },
        lastSpeaker: null,
        sentences: [
          {
            content: 'First.',
            words: [],
            start: 0.5,
            end: 1.0
          },
          {
            content: 'Second.',
            words: [],
            start: 1.5,
            end: 2.0
          }
        ]
      };

      vi.mocked(getSentences).mockReturnValue(mockSentences);

      const result = formatTranscriptionJob(mockJob as SyncPrerecordedResponse);

      expect(result).toContain('00:00:00.500 -> 00:00:01.000: First.');
      expect(result).toContain('00:00:01.500 -> 00:00:02.000: Second.');
    });
  });

  describe('formatTranscriptionJobJson', () => {
    const mockJob = {
      results: {
        channels: [
          {
            alternatives: [
              {
                words: []
              }
            ]
          }
        ]
      }
    } as unknown as Partial<SyncPrerecordedResponse>;

    it('should format job as JSON array', () => {
      const mockWords: WordBaseEdited[] = [
        {
          word: 'test',
          start: 0.5,
          end: 0.8,
          confidence: 0.95
        }
      ];

      const mockSentences: SentencesAccumulator = {
        currentSentence: { content: '', words: [], start: undefined, end: undefined },
        lastSpeaker: null,
        sentences: [
          {
            content: 'Test sentence.',
            words: mockWords,
            start: 0.5,
            end: 1.2
          }
        ]
      };

      vi.mocked(getSentences).mockReturnValue(mockSentences);

      const result = formatTranscriptionJobJson(mockJob as SyncPrerecordedResponse);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        content: 'Test sentence.',
        index: 0,
        timeStart: 0.5,
        words: mockWords,
        timeEnd: 1.2
      });
    });

    it('should handle multiple sentences with correct indices', () => {
      const mockWords: WordBaseEdited[] = [];

      const mockSentences: SentencesAccumulator = {
        currentSentence: { content: '', words: [], start: undefined, end: undefined },
        lastSpeaker: null,
        sentences: [
          {
            content: 'First.',
            words: mockWords,
            start: 0.5,
            end: 1.0
          },
          {
            content: 'Second.',
            words: mockWords,
            start: 1.5,
            end: 2.0
          },
          {
            content: 'Third.',
            words: mockWords,
            start: 2.5,
            end: 3.0
          }
        ]
      };

      vi.mocked(getSentences).mockReturnValue(mockSentences);

      const result = formatTranscriptionJobJson(mockJob as SyncPrerecordedResponse);

      expect(result).toHaveLength(3);
      expect(result[0].index).toBe(0);
      expect(result[1].index).toBe(1);
      expect(result[2].index).toBe(2);
      expect(result[0].content).toBe('First.');
      expect(result[1].content).toBe('Second.');
      expect(result[2].content).toBe('Third.');
    });

    it('should handle undefined start and end times', () => {
      const mockWords: WordBaseEdited[] = [];

      const mockSentences: SentencesAccumulator = {
        currentSentence: { content: '', words: [], start: undefined, end: undefined },
        lastSpeaker: null,
        sentences: [
          {
            content: 'Test',
            words: mockWords,
            start: undefined,
            end: undefined
          }
        ]
      };

      vi.mocked(getSentences).mockReturnValue(mockSentences);

      const result = formatTranscriptionJobJson(mockJob as SyncPrerecordedResponse);

      expect(result[0].timeStart).toBeUndefined();
      expect(result[0].timeEnd).toBeUndefined();
    });
  });
});
