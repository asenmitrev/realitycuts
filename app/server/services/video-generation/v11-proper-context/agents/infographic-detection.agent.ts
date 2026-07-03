import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { getLlm } from '../../../../config/llm';
import { logger } from '../../../logging';

const llm = getLlm();

export type InfographicPick = {
  sentenceIndex: number;
  dataPoints: string[];
  reason: string;
};

const InfographicPickSchema = z.object({
  sentenceIndex: z.number().describe('Index of the sentence in the provided list'),
  dataPoints: z.array(z.string()).describe('Key numbers/facts to visualize, e.g. ["72%", "of users"]'),
  reason: z.string().describe('Short reason why this sentence benefits from an infographic')
});

const InfographicPicksSchema = z.object({
  picks: z
    .array(InfographicPickSchema)
    .max(4)
    .describe('At most 4 sentences that would benefit from an animated infographic')
});

const chatPrompt = ChatPromptTemplate.fromMessages<{
  transcript: string;
  sentencesJson: string;
}>([
  new SystemMessage(
    `You are an expert at identifying which parts of a video script would benefit from an animated infographic (charts, stats, numbers) instead of stock b-roll.

Your task: Given the full transcript and a list of sentences with their index, text, and time range, pick at most 2 sentences that contain statistics, percentages, comparisons, growth metrics, dollar amounts, rankings, or numerical trends that would benefit from visual data representation.

Selection criteria:
- The sentence must contain concrete data: numbers, percentages, dollar amounts, rankings, growth rates, comparisons (e.g. "72% of users", "$3.2M revenue", "sales grew 40%", "top 5 causes", "3 out of 4").
- Prefer sentences where a chart, counter, or data visualization would add clear value.
- Skip sentences that are purely narrative or descriptive without numbers.
- Return at most 2 picks. Return an empty picks array if no sentences qualify.`
  ),
  [
    'human',
    `Full transcript:\n{transcript}\n\nSentences (index, text, timeStart, timeEnd):\n{sentencesJson}`
  ]
]);

const chain = chatPrompt.pipe(llm.withStructuredOutput(InfographicPicksSchema));

async function invoke(args: {
  transcript: string;
  sentences: Array<{ index: number; text: string; timeStart: number; timeEnd: number }>;
}): Promise<InfographicPick[]> {
  const sentencesJson = args.sentences
    .map(
      s =>
        `[${s.index}] ${s.text} (${s.timeStart.toFixed(1)}s - ${s.timeEnd.toFixed(1)}s)`
    )
    .join('\n');

  try {
    const result = await chain.invoke({
      transcript: args.transcript,
      sentencesJson
    });
    return result.picks;
  } catch (e) {
    logger.warn('Infographic detection agent failed', { error: e });
    return [];
  }
}

export const infographicDetectionAgent = { invoke };
