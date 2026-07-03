import { youtube } from 'googleapis/build/src/apis/youtube';
import { youtubeRegex } from 'shared/config/regex';
import { YOUTUBE_API_KEY } from '../config/const';
import { logger } from 'server/services/logging';
import { createClaudeVisionCheapCompletion } from './ai/anthropic';
// Initialize the YouTube API client
const ytClient = youtube({
  version: 'v3',
  auth: YOUTUBE_API_KEY // API key authentication
});

export function extractVideoId(url: string) {
  const regex = youtubeRegex;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export async function searchYoutubeVideos(query: string, maxResults = 8) {
  try {
    const response = await ytClient.search.list({
      part: ['snippet'],
      q: query,
      type: ['video'],
      videoDuration: 'medium',
      maxResults,
      relevanceLanguage: 'en',
      safeSearch: 'none'
    });
    return (response.data.items ?? [])
      .filter(item => !!item.id?.videoId)
      .map(item => ({
        videoId: item.id!.videoId!,
        title: item.snippet?.title ?? '',
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? '',
        channelTitle: item.snippet?.channelTitle ?? '',
        youtubeUrl: `https://www.youtube.com/watch?v=${item.id!.videoId}`
      }));
  } catch (error) {
    logger.error('Error searching YouTube videos:', error);
    return [];
  }
}

/**
 * Search YouTube for videos, fetch their descriptions, and use Claude to pick
 * the most relevant ones. Designed for free-user flows where we want fewer but
 * higher-quality results.
 */
export async function searchAndFilterYoutubeVideos(query: string, finalCount = 3) {
  const candidates = await searchYoutubeVideos(query, 20);
  if (candidates.length === 0) return [];

  // Fetch full details (includes description and language) for all candidates
  const details = await fetchYTVideoDetails(candidates.map(v => v.youtubeUrl));
  const detailsMap = new Map(
    (details?.items ?? []).map(item => [item.id!, item.snippet?.description ?? ''])
  );
  const audioLanguageMap = new Map(
    (details?.items ?? []).map(item => [item.id!, item.snippet?.defaultAudioLanguage ?? ''])
  );

  // Keep only English-language videos; fall back to all candidates if none qualify
  const englishCandidates = candidates.filter(v => {
    const lang = audioLanguageMap.get(v.videoId) ?? '';
    return lang === '' || lang.startsWith('en');
  });
  const filteredCandidates = englishCandidates.length > 0 ? englishCandidates : candidates;

  // Build a numbered list for Claude to evaluate
  const videoList = filteredCandidates
    .map((v, i) => {
      const description = detailsMap.get(v.videoId) ?? '';
      return `${i + 1}. Title: "${v.title}"\n   Description: ${description.slice(0, 300)}`;
    })
    .join('\n\n');

  const prompt = `You are helping select the most relevant YouTube videos for a b-roll footage library.

Topic: "${query}"

Videos:
${videoList}

Return ONLY the numbers (1-based) of the ${finalCount} most relevant videos, as a JSON array. Example: [1, 3, 5]
Choose videos whose title and description closely match the topic. Reject anything that is only tangentially related.`;

  let selectedIndices: number[] = [];
  try {
    const response = await createClaudeVisionCheapCompletion([{ role: 'user', content: prompt }]);
    const match = response.match(/\[[\d,\s]+\]/);
    if (match) {
      selectedIndices = JSON.parse(match[0])
        .map((n: number) => n - 1) // convert to 0-based
        .filter((i: number) => i >= 0 && i < filteredCandidates.length)
        .slice(0, finalCount);
    }
  } catch (error) {
    logger.error('Error filtering YouTube videos with Claude:', error);
  }

  // Fall back to first `finalCount` results if filtering failed
  if (selectedIndices.length === 0) {
    logger.info('Claude relevance filter failed, falling back to top results');
    return filteredCandidates.slice(0, finalCount);
  }

  return selectedIndices.map(i => filteredCandidates[i]);
}

export async function fetchYTVideoDetails(videoIds: string[]) {
  try {
    // Call the videos.list method
    const response = await ytClient.videos.list({
      part: ['snippet', 'contentDetails'], // Specify the parts of the video resource you want to retrieve
      id: videoIds.map(extractVideoId).filter((videoId): videoId is string => videoId !== null) // Array of video IDs
    });
    // Return the video details
    return response.data;
  } catch (error) {
    logger.error('Error fetching YouTube video details:', error);
    return null;
  }
}
