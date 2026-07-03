import { createClaudeVisionCheapCompletion } from '../../../ai/anthropic';
import Anthropic from '@anthropic-ai/sdk';

export async function overlayRankingAgent(sentence: string, context: string, photosToRank: string[]): Promise<number> {
  const photosMessages: Anthropic.ContentBlockParam[] = photosToRank.map((photo, index) => ({
    type: 'image',
    source: {
      type: 'url',
      url: photo
    }
  }));
  const result = await createClaudeVisionCheapCompletion([
    {
      role: 'user',
      content: `
Your task is to analyze ${
        photosMessages.length
      } potential photo overlays and rank them based on their relevance to the given sentence and context.
Consider these factors when ranking:
1. Visual relevance to the specific content
2. Emotional alignment with the context
3. Professional appropriateness
4. Visual quality and composition
5. Potential impact on viewer engagement

You must return your response in exactly this format:
chosen_photo_number

Where chosen_photo_number is the number ${Array.from({ length: photosMessages.length }, (_, i) => i + 1).join(
        ', '
      )} of the best photo. Avoid any other text or formatting, descriptions or explanations.

Example output:
1

AND YOUR RESPONSE IS:`
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Sentence: ${sentence}\nContext: ${context}`
        },
        ...photosMessages
      ]
    }
  ]);
  // const result = await llm.pipe(outputParser).invoke(messages);
  if (result.includes('1') || result.includes('2') || result.includes('3')) {
    switch (result) {
      case '1':
        return 0;
      case '2':
        return 1;
      case '3':
        return 2;
    }
  }
  return 0;
}
