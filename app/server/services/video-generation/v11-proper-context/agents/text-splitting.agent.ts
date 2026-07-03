import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { logger } from 'server/services/logging';
import { getLlm } from '../../../../config/llm';

const llm = getLlm();
const backupLLM = getLlm();
const outputParser = new StringOutputParser();

const chatPrompt = ChatPromptTemplate.fromMessages<{
  script: string;
}>([
  new SystemMessage('Your are a video editor overlaying b-roll on that script.'),
  [
    'human',
    `I will post a script. Your task is to break down this script into pieces where b-rolls will change. Wherever b-roll changes, we mark a cut with a | character. Please mark all cuts, making sure each piece of script between two cuts is meaningful. Respond with only the script and the cuts, nothing else, Your answer will be used programatically. There must be a minimum of 2 words between cuts. Do not show cuts at the beginning and end of the video.
    Script: {script}
    `
  ]
]);
const textSplittingAgent = chatPrompt.pipe(llm).pipe(outputParser);
const backupSplittingAgent = chatPrompt.pipe(backupLLM).pipe(outputParser);
export const splitText = async (script: string) => {
  try {
    const response = await textSplittingAgent.invoke({ script });
    return response;
  } catch (e) {
    logger.error('Error splitting text', e);
    const response = await backupSplittingAgent.invoke({ script });
    return response;
  }
};
