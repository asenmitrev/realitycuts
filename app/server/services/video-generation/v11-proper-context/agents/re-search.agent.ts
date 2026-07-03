import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getLlm } from '../../../../config/llm';

const llm = getLlm();

const outputParser = new StringOutputParser();

const chatPrompt = ChatPromptTemplate.fromMessages<{
  script: string;
  context: string;
  searchTerms: string;
  guidance: string;
}>([
  new SystemMessage('You are an expert at doing follow-up searches for b-roll for a video segment.'),
  [
    'human',
    `I will provide you with a part of a segment covered by b-roll, including the script and the context of the video segment. The b-roll currently used is inappropriate and was found using a specific search term, which I will provide. Your task is to suggest follow-up search terms for finding appropriate b-roll.

Important Requirements:

- The new search term must be appropriate for the context of the video segment.
- Keep the search term concise (no more than 5 words).
- Respond with a single search term only. Do not include any additional text.

Example search term:
Man holding a knife

Script: {script}
Context: {context}
Previous Search Terms: {searchTerms}
Guidance (this can include things like the theme of the video, the scriptwriting, etc. Only take into account the guidance for search term generation): {guidance}
    `
  ]
]);
export const reSearchAgent = chatPrompt.pipe(llm).pipe(outputParser);
