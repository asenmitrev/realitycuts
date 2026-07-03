import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { getLlm } from '../config/llm';

const llm = getLlm();

const chatPrompt = ChatPromptTemplate.fromMessages<{ input: string }>([
  new SystemMessage(
    `You are an expert at analyzing user input for video creation. Another LLM has generated a script, but it sometimes inserts its own thoughts into the script. Please remove those thoughts and return only the script. NOTHING ELSE, as I will use the script as is. The script might contain a title, remove that, but keep everything else as is. If the script includes a CTA to visit some website, or that the video is made with realitycuts.com or 1703.co, please leave that, as it is important to monetize the video.
PLEASE DO THIS CAREFULLY, RETURN ONLY THE SCRIPT PLEASE!`
  ),
  ['human', `Script: {input}`]
]);

export const annotationRemoverAgent = chatPrompt.pipe(llm);
