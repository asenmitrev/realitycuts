import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getLlm } from '../config/llm';

const llm = getLlm();


const outputParser = new StringOutputParser();

const chatPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(
    `You are an expert at analyzing user input for video creation. The user may provide either a full video script (what the narrator would say, word for word), or a prompt (an idea or topic for a video, not a full script).\n\nIf the input is a script, respond with:\nTYPE: script\nSCRIPT: <the script, unchanged, except REMOVE ALL annotations, stage directions, or bracketed text such as [ARCHIVE FOOTAGE: ...], [MAP ANIMATION: ...], [SLOW ZOOM: ...], etc. Only return the spoken words. Do NOT include SCRIPT: if there are no annotations — just respond with TYPE: script and I will use the original.>\n\nIf the input is a prompt, respond with:\nTYPE: prompt\nSCRIPT: <write a full engaging video narration script based on the prompt. 3-5 sentences. Only the spoken words, no stage directions or annotations.>`
  ),
  ['human', `Input: {input}`]
]);

const agent = chatPrompt.pipe(llm).pipe(outputParser);

export async function analyzeAndGenerateScript(input: string): Promise<{ type: 'script' | 'prompt'; script: string }> {
  const result = await agent.invoke({ input });
  // Parse the result
  const typeMatch = result.match(/TYPE: (script|prompt)/i);
  const scriptMatch = result.match(/SCRIPT:([\s\S]*)/i);
  const type = typeMatch ? (typeMatch[1].toLowerCase() as 'script' | 'prompt') : 'script';
  // For scripts without annotations the LLM returns only TYPE: script — use original input.
  // For prompts we always expect a generated SCRIPT: block; fall back to input only as last resort.
  const script = scriptMatch ? scriptMatch[1].trim() : input;
  return { type, script };
}
