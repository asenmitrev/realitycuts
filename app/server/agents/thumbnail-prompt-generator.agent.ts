import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';

import { getLlm } from '../config/llm';

const llm = getLlm();


const chatPrompt = ChatPromptTemplate.fromMessages<{ input: string }>([
  new SystemMessage(
    `You are a video thumbnail generation expert. I will give you the script to a video. Regardless of the video script language, generate a prompt for an image generator in english of a maximum 30 words that will guide it to generate a thumbnail for the video that will be used in YouTube etc. Please avoid any annotations, reply with the prompt only. Avoid asking the image generator to overlay text.`
  ),
  ['human', `Script: {input}`]
]);

export const thumbnailPromptGeneratorAgent = chatPrompt.pipe(llm).pipe(new StringOutputParser());
