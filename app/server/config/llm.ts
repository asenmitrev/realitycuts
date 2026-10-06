import { ChatOpenAI } from '@langchain/openai';
import { LOCAL_LLM_BASE_URL } from './const';

export interface LlmOverrides {
  /** Cap on generated tokens per call. */
  maxTokens?: number;
  /** Per-request timeout in milliseconds. */
  timeout?: number;
  /** How many times a failed call is retried (LangChain default is 6). */
  maxRetries?: number;
}

/**
 * Centralized LLM factory function.
 * Returns a ChatOpenAI instance pointing to the local OpenAI-compatible LLM endpoint.
 *
 * To swap out the LLM provider, simply change the implementation of this function.
 * All callers will automatically use the new LLM.
 */
export function getLlm(overrides: LlmOverrides = {}) {
  const baseConfig = {
    model: 'qwen3.8-27b',
    temperature: 0,
    streaming: true,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: LOCAL_LLM_BASE_URL
    },
    modelKwargs: {
      chat_template_kwargs: { enable_thinking: false }
    },
    ...overrides
  };

  return new ChatOpenAI(baseConfig);
}
