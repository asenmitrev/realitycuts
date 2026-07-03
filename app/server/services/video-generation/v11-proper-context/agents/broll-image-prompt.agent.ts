import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';

import { getLlm } from '../../../../config/llm';

const llm = getLlm();

const chatPrompt = ChatPromptTemplate.fromMessages<{
  script: string;
  context: string;
  guidance: string;
}>([
  new SystemMessage(
    `You are a stock photo generation expert. Given a video script sentence and its context, generate a concise image prompt (max 30 words) for a photorealistic b-roll image that visually complements the narration. The image should look like professional stock footage. Reply with the prompt only. Avoid asking the image generator to overlay text.`
  ),
  [
    'human',
    `Script: {script}
Context: {context}
Guidance (theme, style, etc.): {guidance}`
  ]
]);

export const brollImagePromptAgent = chatPrompt.pipe(llm).pipe(new StringOutputParser());
