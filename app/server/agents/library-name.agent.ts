import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';

import { getLlm } from '../config/llm';

const llm = getLlm();

const outputParser = new StringOutputParser();

const chatPrompt = ChatPromptTemplate.fromMessages<{ prompt: string }>([
  new SystemMessage(
    'You are a naming assistant. Generate a short, descriptive library name (2-5 words) based on the video topic or prompt provided. The name should be concise, clear, and suitable as a content library label. Do not include quotes, punctuation, or explanations — return only the name itself.'
  ),
  [
    'human',
    `Generate a library name for this video prompt:
Prompt: {prompt}`
  ]
]);

const chain = chatPrompt.pipe(llm).pipe(outputParser);

export const generateLibraryName = async (prompt: string): Promise<string> => {
  return chain.invoke({ prompt });
};
