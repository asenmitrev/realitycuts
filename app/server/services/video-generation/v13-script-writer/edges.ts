import { AIMessage } from '@langchain/core/messages';
import { ScriptWriterState } from './state';
import { logger } from '../../../services/logging';

// Library footage is sampled at most this many times before we accept the latest topic as-is.
const MAX_LIBRARY_SAMPLES = 3;

export function checkTopicPresenceInHistory(state: typeof ScriptWriterState.State): string {
  const { messages, topicRetries, topic, librarySamples } = state;
  const lastMessage = messages[messages.length - 1] as AIMessage | undefined;
  const binaryScore = lastMessage?.tool_calls?.[0]?.args?.binaryScore;

  if (typeof binaryScore !== 'string') {
    // The model skipped the tool call; don't crash the whole job over the history check.
    logger.warn('[ScriptWriter] Topic history check returned no verdict -> treating topic as new', { topic });
    return 'no';
  }

  if (binaryScore.trim().toLowerCase() === 'yes') {
    if (topicRetries > 5) {
      if (librarySamples >= MAX_LIBRARY_SAMPLES) {
        logger.warn('[ScriptWriter] Topic already used but resample budget exhausted -> using it anyway', {
          topic,
          topicRetries,
          librarySamples
        });
        return 'no';
      }
      logger.info('[ScriptWriter] Topic already used and retries exhausted -> resampling library footage', {
        topic,
        topicRetries,
        librarySamples
      });
      return 'resample';
    }
    logger.info('[ScriptWriter] Topic already used -> retrying with a new topic', { topic, topicRetries });
    return 'yes';
  }
  logger.info('[ScriptWriter] Topic is new -> proceeding to script generation', { topic, topicRetries });
  return 'no';
}

export function shouldDoToolCall(state: typeof ScriptWriterState.State): string {
  logger.debug('---SHOULD WE DO TOOL CALL---');
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  let shouldDoToolCall = 'no';
  if ('tool_calls' in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls?.length) {
    shouldDoToolCall = 'yes';
  }
  logger.debug(`---DECISION: SHOULD DO TOOL CALL: ${shouldDoToolCall}---`);
  return shouldDoToolCall;
}

export function shouldFetchViralTopics(state: typeof ScriptWriterState.State): string {
  logger.debug('---SHOULD FETCH VIRAL TOPICS---');
  const { linkedChannelIds } = state;

  // Check if we have linked channels to analyze
  if (linkedChannelIds && linkedChannelIds.length > 0) {
    logger.debug(`---DECISION: YES (${linkedChannelIds.length} channels linked)---`);
    return 'yes';
  }

  logger.debug('---DECISION: NO (no channels linked)---');
  return 'no';
}
