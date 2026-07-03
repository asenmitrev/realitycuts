import type { WordBaseEdited } from '../../../../types/video-ai-data';
import { logger } from '../../../logging';
import { searchOptimizationAgent } from '../agents/search-optimization.agent';

export const generateSearchTermForSentence = async (
  words: WordBaseEdited[],
  previousSentences: string[],
  context: string,
  timeStart: number,
  _isTalkingHead: boolean,
  _globalContext: string,
  guidance: string
) => {
  const start = timeStart < 0.3 ? 0 : timeStart;
  const sentenceContent = words.map(w => w.punctuated_word ?? w.word).join(' ');

  const response = await searchOptimizationAgent.invoke({
    sentence: sentenceContent,
    context,
    previousSearchTerms: previousSentences.join(', '),
    guidance
  });

  const rawResponse = response.trim();

  // The searchOptimization agent is instructed to return:
  // `specific$&$general$&$vector`
  // In practice we sometimes see a delimiter typo like `$&` (missing trailing `$`),
  // which would previously cause parsing to fail and the segment to be skipped.
  let searchTerms = rawResponse.split('$&$');
  if (searchTerms.length < 3) {
    searchTerms = rawResponse.split('$&');
  }

  if (searchTerms?.length >= 3) {
    const clean = (v?: string) => v?.trim().replace(/^\$+/, '') ?? '';
    return {
      time_start: start,
      first_search_prompt: clean(searchTerms[0]).substring(0, 1000),
      second_search_prompt: clean(searchTerms[1]).substring(0, 1000),
      vector_search_prompt: clean(searchTerms[2]).substring(0, 1000)
    };
  } else if (context.toLowerCase().includes('skip')) {
    return null;
  } else {
    logger.error('GPT Error while processing sentence', {
      'Sentence Content': sentenceContent,
      Context: context,
      'Previous Sentences': previousSentences,
      Response: rawResponse,
      ParsedSearchTermsCount: searchTerms.length
    });
    return null;
  }
};
