import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getLlm } from '../../../../config/llm';

const llm = getLlm();

const outputParser = new StringOutputParser();
// Define a prompt template

const chatPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(
    'You are an expert at generating context for a video transcript. Your task is to summarise what is being said in the video in as few words as possible, no more than one sentence. Respond with nothing but the sentence, no clarifications or anything else.'
  ),
  [
    'human',
    `Generate context for the following transcript:
      Transcript: {transcript}`
  ]
]);
export const totalContextAnalysisAgent = chatPrompt.pipe(llm).pipe(outputParser);
