import type Anthropic from '@anthropic-ai/sdk';
import retry from 'retry';
import { logger } from '../logging';
import { getLlm } from '../../config/llm';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

/**
 * Convert Anthropic MessageParam to LangChain messages for the local LLM.
 * Image sources are passed through as base64 data URLs (OpenAI-compatible format).
 */
function convertMessages(anthropicMessages: Anthropic.MessageParam[]): (HumanMessage | AIMessage)[] {
  const result: (HumanMessage | AIMessage)[] = [];

  for (const msg of anthropicMessages) {
    const role = msg.role;
    const content = msg.content;

    // If content is a simple string
    if (typeof content === 'string') {
      if (role === 'assistant') {
        result.push(new AIMessage(content));
      } else {
        result.push(new HumanMessage(content));
      }
      continue;
    }

    // Content is an array of blocks (text + images)
    // Build a homogeneous content array of typed objects — the local LLM
    // endpoint rejects mixed string/object arrays.
    const parts: { type: string; text?: string; image_url?: { url: string } }[] = [];
    for (const block of content) {
      if (block.type === 'text') {
        parts.push({ type: 'text', text: block.text });
      } else if (block.type === 'image') {
        // Anthropic image source — convert to OpenAI-compatible image_url
        let imageUrl: string;
        if ('url' in block.source) {
          imageUrl = block.source.url;
        } else if ('data' in block.source) {
          const mediaType = block.source.media_type || 'image/jpeg';
          imageUrl = `data:${mediaType};base64,${block.source.data}`;
        } else {
          continue;
        }
        parts.push({ type: 'image_url', image_url: { url: imageUrl } });
      }
    }

    if (role === 'assistant') {
      result.push(new AIMessage(parts));
    } else {
      result.push(new HumanMessage(parts));
    }
  }

  return result;
}

const llm = getLlm();

export const createClaudeVisionCheapCompletion = async (messages: Anthropic.MessageParam[]): Promise<string> => {
  const operation = retry.operation({
    retries: 5,
    factor: 2,
    minTimeout: 5000,
    maxTimeout: 60000
  });

  return new Promise<string>((resolve, reject) => {
    operation.attempt(async currentAttempt => {
      try {
        const langchainMessages = convertMessages(messages);
        const response = await llm.invoke(langchainMessages);
        const text = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);
        resolve(text);
      } catch (error: any) {
        if (operation.retry(error as Error)) {
          logger.info('Retrying local LLM vision completion', {
            issue: error.toString().replaceAll(/error/gi, 'issue'),
            messageCount: messages.length,
            attempt: currentAttempt
          });
          return;
        }
        reject(operation.mainError());
      }
    });
  });
};
