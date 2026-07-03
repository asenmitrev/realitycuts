import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getLlm } from '../config/llm';

const llm = getLlm();


const outputParser = new StringOutputParser();
const chatPrompt = ChatPromptTemplate.fromMessages<{ transcript: string }>([
  new SystemMessage(
    'You are a YouTube description writer. Create an engaging description based on the video transcript provided. Make the description 100 words or less. Include emojis. Include relevant hashtags at the end. Match the language of the transcript.'
  ),
  [
    'human',
    `Write a YouTube description for a video with this transcript:
    Transcript: {transcript}`
  ]
]);
export const videoDescriptionSuggestionAgent = chatPrompt.pipe(llm).pipe(outputParser);
