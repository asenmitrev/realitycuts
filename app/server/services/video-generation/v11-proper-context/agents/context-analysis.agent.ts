import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getLlm } from '../../../../config/llm';

const llm = getLlm();

const outputParser = new StringOutputParser();
// Define a prompt template

const chatPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(
    'You are an expert at generating context for a video transcript. Your task is to summarise what is being said in the sentence and the surrounding sentences. Please only explain the meaning behind the sentence and the surrounding sentences, trying to extrapolate in one or two sentences what is being talked about.'
  ),
  [
    'human',
    `Generate context for the following part of a transcript:
      Sentence: {sentence}
      Surrounding Paragraph: {surroundingSentences}`
  ]
]);
export const contextAnalysisAgent = chatPrompt.pipe(llm).pipe(outputParser);
