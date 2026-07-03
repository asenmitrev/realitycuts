import { describe, it, expect } from 'vitest';
import { getEditedWordsList } from '../get-edited-words';
import { SyncPrerecordedResponse } from '@deepgram/sdk';

describe('getEditedWordsList', () => {
  it('should map words with isVisible and isParagraphEnd properties', () => {
    const mockTranscript: Partial<SyncPrerecordedResponse> = {
      results: {
        channels: [
          {
            alternatives: [
              {
                words: [
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
                ],
                paragraphs: {
                  paragraphs: [
                    {
                      sentences: [],
                      num_words: 2,
                      start: 0.5,
                      end: 1.2
                    }
                  ],
                  transcript: ''
                }
              }
            ]
          }
        ]
      }
    } as unknown as Partial<SyncPrerecordedResponse>;

    const result = getEditedWordsList(mockTranscript as SyncPrerecordedResponse);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      word: 'Hello',
      isVisible: true,
      isParagraphEnd: false // word.end (0.8) does not match paragraph.end (1.2)
    });
    expect(result[1]).toMatchObject({
      word: 'world',
      isVisible: true,
      isParagraphEnd: true // word.end (1.2) matches paragraph.end (1.2)
    });
  });

  it('should set isParagraphEnd to false when word end does not match paragraph end', () => {
    const mockTranscript: Partial<SyncPrerecordedResponse> = {
      results: {
        channels: [
          {
            alternatives: [
              {
                words: [
                  {
                    word: 'Hello',
                    start: 0.5,
                    end: 0.8,
                    confidence: 0.95
                  },
                  {
                    word: 'world',
                    start: 0.8,
                    end: 1.0,
                    confidence: 0.92
                  }
                ],
                paragraphs: {
                  paragraphs: [
                    {
                      sentences: [],
                      num_words: 2,
                      start: 0.5,
                      end: 1.2 // Different from word ends
                    }
                  ],
                  transcript: ''
                }
              }
            ]
          }
        ]
      }
    } as unknown as Partial<SyncPrerecordedResponse>;

    const result = getEditedWordsList(mockTranscript as SyncPrerecordedResponse);

    expect(result).toHaveLength(2);
    expect(result[0].isParagraphEnd).toBe(false);
    expect(result[1].isParagraphEnd).toBe(false);
  });

  it('should handle words where one matches paragraph end', () => {
    const mockTranscript: Partial<SyncPrerecordedResponse> = {
      results: {
        channels: [
          {
            alternatives: [
              {
                words: [
                  {
                    word: 'First',
                    start: 0.5,
                    end: 0.8,
                    confidence: 0.95
                  },
                  {
                    word: 'last',
                    start: 0.8,
                    end: 1.2,
                    confidence: 0.92
                  }
                ],
                paragraphs: {
                  paragraphs: [
                    {
                      sentences: [],
                      num_words: 2,
                      start: 0.5,
                      end: 1.2 // Matches second word end
                    }
                  ],
                  transcript: ''
                }
              }
            ]
          }
        ]
      }
    } as unknown as Partial<SyncPrerecordedResponse>;

    const result = getEditedWordsList(mockTranscript as SyncPrerecordedResponse);

    expect(result).toHaveLength(2);
    expect(result[0].isParagraphEnd).toBe(false);
    expect(result[1].isParagraphEnd).toBe(true);
  });

  it('should handle multiple paragraphs', () => {
    const mockTranscript: Partial<SyncPrerecordedResponse> = {
      results: {
        channels: [
          {
            alternatives: [
              {
                words: [
                  {
                    word: 'First',
                    start: 0.5,
                    end: 0.8,
                    confidence: 0.95
                  },
                  {
                    word: 'paragraph',
                    start: 0.8,
                    end: 1.2,
                    confidence: 0.92
                  },
                  {
                    word: 'Second',
                    start: 2.0,
                    end: 2.5,
                    confidence: 0.9
                  },
                  {
                    word: 'paragraph',
                    start: 2.5,
                    end: 3.0,
                    confidence: 0.88
                  }
                ],
                paragraphs: {
                  paragraphs: [
                    {
                      sentences: [],
                      num_words: 2,
                      start: 0.5,
                      end: 1.2
                    },
                    {
                      sentences: [],
                      num_words: 2,
                      start: 2.0,
                      end: 3.0
                    }
                  ],
                  transcript: ''
                }
              }
            ]
          }
        ]
      }
    } as unknown as Partial<SyncPrerecordedResponse>;

    const result = getEditedWordsList(mockTranscript as SyncPrerecordedResponse);

    expect(result).toHaveLength(4);
    expect(result[0].isParagraphEnd).toBe(false);
    expect(result[1].isParagraphEnd).toBe(true); // Matches first paragraph end
    expect(result[2].isParagraphEnd).toBe(false);
    expect(result[3].isParagraphEnd).toBe(true); // Matches second paragraph end
  });

  it('should handle missing paragraphs', () => {
    const mockTranscript: Partial<SyncPrerecordedResponse> = {
      results: {
        channels: [
          {
            alternatives: [
              {
                words: [
                  {
                    word: 'Hello',
                    start: 0.5,
                    end: 0.8,
                    confidence: 0.95
                  }
                ],
                paragraphs: undefined
              }
            ]
          }
        ]
      }
    } as unknown as Partial<SyncPrerecordedResponse>;

    const result = getEditedWordsList(mockTranscript as SyncPrerecordedResponse);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      word: 'Hello',
      isVisible: true,
      isParagraphEnd: undefined
    });
  });

  it('should preserve all original word properties', () => {
    const mockTranscript: Partial<SyncPrerecordedResponse> = {
      results: {
        channels: [
          {
            alternatives: [
              {
                words: [
                  {
                    word: 'Hello',
                    start: 0.5,
                    end: 0.8,
                    confidence: 0.95,
                    punctuated_word: 'Hello',
                    speaker: 1,
                    speaker_confidence: 0.98
                  }
                ],
                paragraphs: {
                  paragraphs: [],
                  transcript: ''
                }
              }
            ]
          }
        ]
      }
    } as unknown as Partial<SyncPrerecordedResponse>;

    const result = getEditedWordsList(mockTranscript as SyncPrerecordedResponse);

    expect(result[0]).toMatchObject({
      word: 'Hello',
      start: 0.5,
      end: 0.8,
      confidence: 0.95,
      punctuated_word: 'Hello',
      speaker: 1,
      speaker_confidence: 0.98,
      isVisible: true,
      isParagraphEnd: false
    });
  });

  it('should handle empty words array', () => {
    const mockTranscript: Partial<SyncPrerecordedResponse> = {
      results: {
        channels: [
          {
            alternatives: [
              {
                words: [],
                paragraphs: {
                  paragraphs: [],
                  transcript: ''
                }
              }
            ]
          }
        ]
      }
    } as unknown as Partial<SyncPrerecordedResponse>;

    const result = getEditedWordsList(mockTranscript as SyncPrerecordedResponse);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });
});
