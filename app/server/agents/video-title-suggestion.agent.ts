import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';

import { getLlm } from '../config/llm';

const llm = getLlm();


const outputParser = new StringOutputParser();
const chatPrompt = ChatPromptTemplate.fromMessages<{ transcript: string }>([
  new SystemMessage(
    'You are a YouTube title writer. Create a catchy, engaging, and SEO-friendly title based on the video transcript provided. The title should be between 5-10 words. Make it compelling but not clickbait. Do not include quotes in your response. Match the language of the transcript.'
  ),
  [
    'human',
    `Write a YouTube title for a video with this transcript:
    Transcript: {transcript}`
  ]
]);
export const videoTitleSuggestionAgent = chatPrompt.pipe(llm).pipe(outputParser);
