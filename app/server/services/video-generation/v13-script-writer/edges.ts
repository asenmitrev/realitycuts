import { AIMessage } from '@langchain/core/messages';
import { ScriptWriterState } from './state';
import { logger } from '../../../services/logging';

export function checkTopicPresenceInHistory(state: typeof ScriptWriterState.State): string {
  logger.debug('---CHECK RELEVANCE---');

  const { messages, topicRetries } = state;
  const lastMessage = messages[messages.length - 1];
  if (!('tool_calls' in lastMessage)) {
    throw new Error("The 'checkTopicPresenceInHistory' node requires the most recent message to contain tool calls.");
  }
  const toolCalls = (lastMessage as AIMessage).tool_calls;
  if (!toolCalls || !toolCalls.length) {
    throw new Error('Last message was not a function message');
  }

  if (toolCalls[0].args.binaryScore === 'yes') {
    logger.debug('---DECISION: TOPIC PRESENT IN HISTORY---');

    if (topicRetries > 5) {
      logger.debug('---DECISION: TOPIC RETRIES EXCEEDED---');
      return 'resample';
    }
    return 'yes';
  }
  logger.debug('---DECISION: TOPIC NOT PRESENT IN HISTORY---');
  logger.debug('---TOPIC: ', state.topic);
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
