import { describe, expect, it, vi } from 'vitest';
import { AIMessage } from '@langchain/core/messages';

vi.mock('../../../../services/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}));

import { checkTopicPresenceInHistory } from '../edges';

const verdict = (binaryScore?: string) =>
  new AIMessage({
    content: '',
    tool_calls:
      binaryScore === undefined
        ? []
        : [{ name: 'determine_topic_presence_in_history', args: { binaryScore }, id: 'call-1' }]
  });

const state = (overrides: Record<string, unknown>) =>
  ({ topic: 'topic', topicRetries: 1, librarySamples: 1, messages: [verdict('no')], ...overrides }) as any;

describe('checkTopicPresenceInHistory', () => {
  it('proceeds when the topic is new', () => {
    expect(checkTopicPresenceInHistory(state({}))).toBe('no');
  });

  it('retries the topic when it is already used', () => {
    expect(checkTopicPresenceInHistory(state({ messages: [verdict('Yes')] }))).toBe('yes');
  });

  it('resamples library footage once topic retries run out', () => {
    expect(checkTopicPresenceInHistory(state({ messages: [verdict('yes')], topicRetries: 6 }))).toBe('resample');
  });

  it('stops resampling once the library sample budget is spent', () => {
    expect(
      checkTopicPresenceInHistory(state({ messages: [verdict('yes')], topicRetries: 6, librarySamples: 3 }))
    ).toBe('no');
  });

  it('treats a missing verdict as a new topic instead of throwing', () => {
    expect(checkTopicPresenceInHistory(state({ messages: [verdict()] }))).toBe('no');
  });
});
