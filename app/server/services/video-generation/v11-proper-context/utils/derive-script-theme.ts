import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { getLlm } from '../../../../config/llm';
import { logger } from '../../../logging';

const llm = getLlm();

export type ScriptTheme = {
  topicCategory: string;
  tone: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor1: string;
  accentColor2: string;
  textColor: string;
  styleDescription: string;
};

const ScriptThemeSchema = z.object({
  topicCategory: z.string().describe('e.g. finance, health, technology, food, sports, nature'),
  tone: z.string().describe('e.g. professional, energetic, calm, playful'),
  primaryColor: z.string().describe('Dominant background hex, e.g. #E8DCC8'),
  secondaryColor: z.string().describe('Secondary background hex'),
  accentColor1: z.string().describe('First accent color hex'),
  accentColor2: z.string().describe('Second accent color hex'),
  textColor: z.string().describe('Body text and outlines hex'),
  styleDescription: z
    .string()
    .describe('1-2 sentence aesthetic description for the infographic designer LLM')
});

const chatPrompt = ChatPromptTemplate.fromMessages<{
  title: string;
  transcript: string;
}>([
  new SystemMessage(
    `You are an expert at matching visual design to video content. Given a video title and transcript, output a coherent color palette and style for animated infographics that will appear in the video.

Rules:
- topicCategory: one word (finance, health, technology, food, sports, nature, education, lifestyle, etc.)
- tone: one word (professional, energetic, calm, playful, serious, uplifting, etc.)
- All colors must be valid hex codes (e.g. #E8DCC8). Use colors that suit the topic: e.g. finance → navy/dark blues; health → soft greens; tech → dark with electric blue accents; food → warm earth tones; sports → bold primaries; nature → greens and earth tones.
- styleDescription: 1-2 sentences describing the aesthetic (e.g. "Warm, coffee-shop inspired palette with clean silhouettes and a light airy feel" or "Professional dark theme with electric blue accents, crisp and modern").`
  ),
  ['human', 'Video title: {title}\n\nTranscript (excerpt):\n{transcript}']
]);

const chain = chatPrompt.pipe(llm.withStructuredOutput(ScriptThemeSchema));

/**
 * Derives a ScriptTheme (color palette + style) from the video title and transcript.
 * Used once per video so infographics can share a consistent look that matches the content.
 */
export async function deriveScriptTheme(
  transcript: string,
  title?: string
): Promise<ScriptTheme | undefined> {
  const trimmedTranscript = transcript?.trim();
  const trimmedTitle = title?.trim() || 'Untitled';
  if (!trimmedTranscript) {
    return undefined;
  }
  try {
    const excerpt =
      trimmedTranscript.length > 2000 ? trimmedTranscript.slice(0, 2000) + '...' : trimmedTranscript;
    const result = await chain.invoke({
      title: trimmedTitle,
      transcript: excerpt
    });
    return result;
  } catch (e) {
    logger.warn('Script theme derivation failed, infographics will use default palette', { error: e });
    return undefined;
  }
}
