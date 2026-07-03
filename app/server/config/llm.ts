import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { LOCAL_LLM_BASE_URL } from './const';

const DEFAULT_LOCAL_LLM_BASE_URL = 'https://llm.asenmitrev.uk/v1';

export interface GetLlmOptions {
  /** When true, disables the LLM's thinking/reasoning feature. Default: false. */
  disableThinking?: boolean;
}

/**
 * Centralized LLM factory function.
 * Returns a ChatOpenAI instance pointing to the local OpenAI-compatible LLM endpoint.
 *
 * To swap out the LLM provider, simply change the implementation of this function.
 * All callers will automatically use the new LLM.
 */
export function getLlm(options?: GetLlmOptions) {
  const baseConfig = {
    model: 'qwen/qwen3.6-27b',
    temperature: 0,
    streaming: true,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: LOCAL_LLM_BASE_URL || DEFAULT_LOCAL_LLM_BASE_URL,
    },
  };
  
  return new ChatOpenAI(baseConfig);
}