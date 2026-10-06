import { getTavilyWebSearch } from './tools';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getLlm, LlmOverrides } from '../../../config/llm';

// Bounded so a single call can't hang a job for tens of minutes or be retried six times.
export const SCRIPT_WRITER_LLM_OPTIONS: LlmOverrides = {
  maxTokens: 2048,
  timeout: 4 * 60 * 1000,
  maxRetries: 1
};

export const scriptWriterPrompt = `Your task is to analyze the input and create a script that:
    1. Is engaging and follows best practices for short-form video content
    2. Is truthful and factually accurate

The topic has already been chosen to match the available video footage, so do not try to verify footage.
You may use the web search tool AT MOST TWICE to look up real facts about the topic. After that (or right away, if you already know enough), write the script. Never search again once you have results — write the script.

    INSTRUCTIONS:

    For script generation, follow these principles:
    1. **Hook (0-3 seconds)**: Start with impact, fulfill the thumbnail promise immediately
    2. **Retention**: Use open loops and cliffhanger phrasing
    3. **Energy**: Fast-paced, punchy, energetic delivery
    4. **Ending**: Pay off the hook promise
    5. **Video Integration**: Naturally weave in references to available video content
    6. **Length**: Follow the length specified in the user's request
    7. **FORBIDDEN PHRASES**: NEVER use "Watch as", "See how", "Look at", "Witness", "Behold", or any similar viewer-directing phrasing. These phrases describe specific visual actions that are nearly impossible to match with real footage. Instead, use declarative statements that describe facts, concepts, or ideas (e.g., instead of "Watch as the sun sets over the ocean", write "The sun sets over the ocean every evening in a breathtaking display").
    8. **NO CALLS TO ACTION**: NEVER ask viewers to subscribe, like, follow, or comment (e.g., "subscribe now", "hit the subscribe button", "follow for more"). Also never use "mind-blowing" style reveal phrasing (e.g., "here's the mind-blowing part") — state surprising facts plainly instead.

    Please always reply with only the script, no other text, no explanations, no clarifications, no nothing.`;

// Lazy so the server can boot without the LLM/Tavily keys the agent needs.
let _agent: ReturnType<typeof createReactAgent> | undefined;
export const getScriptWriterAgent = () => {
  if (!_agent) {
    _agent = createReactAgent({
      llm: getLlm(SCRIPT_WRITER_LLM_OPTIONS),
      tools: [getTavilyWebSearch()],
      prompt: scriptWriterPrompt
    });
  }
  return _agent;
};
