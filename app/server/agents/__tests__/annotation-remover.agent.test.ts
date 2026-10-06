import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/llm', () => ({ getLlm: vi.fn(() => ({})) }));

import { stripScriptMarkup } from '../annotation-remover.agent';

describe('stripScriptMarkup', () => {
  it('removes timestamp headers on their own line', () => {
    const script = `**[0:00-0:03]**

В апреле 1945 года Берлин превратился в ад.

**[0:03-0:15]**

Советские войска наступали с севера, юга и запада.

**[0:30-0:45]**`;
    expect(stripScriptMarkup(script)).toBe(
      'В апреле 1945 года Берлин превратился в ад.\n\nСоветские войска наступали с севера, юга и запада.'
    );
  });

  it('removes inline timestamp prefixes and markdown', () => {
    expect(stripScriptMarkup('[0:00 – 0:05] **Hook:** the city burned.')).toBe('Hook: the city burned.');
    expect(stripScriptMarkup('## Intro\nHello there.')).toBe('Intro\nHello there.');
  });

  it('removes bracketed stage directions on their own line', () => {
    expect(stripScriptMarkup('[ARCHIVE FOOTAGE: Berlin]\nThe war ended.')).toBe('The war ended.');
  });

  it('keeps times and colons that are part of the spoken text', () => {
    const script = 'At 3:15 the troops arrived: nobody expected it.';
    expect(stripScriptMarkup(script)).toBe(script);
  });
});
