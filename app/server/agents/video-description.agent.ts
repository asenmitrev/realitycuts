import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';

import { getLlm } from '../config/llm';

const llm = getLlm();


const outputParser = new StringOutputParser();
const chatPrompt = ChatPromptTemplate.fromMessages<{ title: string; description: string }>([
  new SystemMessage(
    'You are a helpful assistant that creates a description for a youtube video. You will receive the description that the user has provided for the video. These descriptions sometimes include adds, offers, shortcuts to times of the video etc. Please take into account all of this information and create a pure text of 3-5 sentences that describes what the video is about. Please make sure to include any names of places, people or anything else in the description or title of the video.'
  ),
  [
    'human',
    `Youtube Video title: {title}
    Youtube Video description: {description}`
  ]
]);
export const videoTitleSuggestionAgent = chatPrompt.pipe(llm).pipe(outputParser);

export async function createYtVideoDescription(title: string, description: string) {
  const output = await videoTitleSuggestionAgent.invoke({ title, description });
  return output;
}
