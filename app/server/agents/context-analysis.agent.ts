import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getLlm } from '../config/llm';

const llm = getLlm();
const outputParser = new StringOutputParser();
// Define a prompt template

const chatPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(
    'You are an expert at generating context for a video transcript. You will receive the entire script of the video. Your task is to determine the topic of the video. If you were to overlay a video on top of the script, what would a search term be for the video? What would you ask a search engine to find this video? Please return only what you want to search for, it can be a long as three sentences.'
  ),
  [
    'human',
    `Generate context for the following part of a transcript:
      Script: {script}`
  ]
]);
export const contextAnalysisAgent = chatPrompt.pipe(llm).pipe(outputParser);
