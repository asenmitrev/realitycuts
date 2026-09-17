import { getTavilyWebSearch } from './tools';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getLlm } from '../../../config/llm';

const prompt = `Your task is to analyze the input and create a script that:
    1. Is engaging and follows best practices for short-form video content
    2. Is truthful and factually accurate, if needed, source footage from the web

When you have an idea for a script, check if there is sufficient footage in the video library to support it, then search the web to inform yourself about the topic and include real facts, and finally write the script.

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
      llm: getLlm(),
      tools: [getTavilyWebSearch()],
      prompt
    });
  }
  return _agent;
};
