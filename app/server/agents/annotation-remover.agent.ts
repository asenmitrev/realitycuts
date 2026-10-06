import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { RunnableLambda } from '@langchain/core/runnables';
import { getLlm } from '../config/llm';

const llm = getLlm();

const chatPrompt = ChatPromptTemplate.fromMessages<{ input: string }>([
  new SystemMessage(
    `You are an expert at analyzing user input for video creation. Another LLM has generated a script, but it sometimes inserts its own thoughts into the script. Please remove those thoughts and return only the script. NOTHING ELSE, as I will use the script as is. The script might contain a title, remove that, but keep everything else as is. If the script includes a CTA to visit some website, or that the video is made with realitycuts.com or 1703.co, please leave that, as it is important to monetize the video.
Also remove anything a narrator would not read aloud: timestamps or time ranges (e.g. [0:00-0:03]), section headers, scene/shot labels, stage directions, bracketed notes and markdown formatting (**, #, bullet points).
PLEASE DO THIS CAREFULLY, RETURN ONLY THE SCRIPT PLEASE!`
  ),
  ['human', `Script: {input}`]
]);

// e.g. "[0:00-0:03]", "(0:15 – 0:30)", "0:30-0:45:", "[00:01:05]"
const TIMESTAMP = String.raw`[\[(]?\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[-–—]\s*\d{1,2}:\d{2}(?::\d{2})?)?\s*[\])]?`;
const TIMESTAMP_LINE = new RegExp(String.raw`^[*_#>\s-]*${TIMESTAMP}[*_\s:.-]*$`);
const TIMESTAMP_PREFIX = new RegExp(String.raw`^\s*(\*\*|__)?\s*${TIMESTAMP}\s*\1?\s*[:.-]?\s*`);
const BRACKETED_LINE = /^[*_\s]*\[[^\]]*\][*_\s]*$/;

/**
 * Deterministic cleanup for markup the LLM pass tends to leave in: timestamp markers, bracketed
 * stage directions on their own line, markdown headers/bold. Spoken text is left untouched.
 */
export function stripScriptMarkup(script: string): string {
  return script
    .split('\n')
    .filter(line => !TIMESTAMP_LINE.test(line) && !BRACKETED_LINE.test(line))
    .map(line =>
      line
        .replace(TIMESTAMP_PREFIX, '')
        .replace(/^#{1,6}\s+/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const annotationRemoverAgent = chatPrompt
  .pipe(llm)
  .pipe(RunnableLambda.from((message: AIMessage) => new AIMessage(stripScriptMarkup(message.text))));
