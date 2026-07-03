import { createClient } from 'pexels';
import { PEXELS_API_KEY } from '../config/const';
import { Alternative } from '../types';
import { logger } from './logging';

if (!PEXELS_API_KEY) {
  throw new Error('PEXELS_API_KEY is not set');
}

const client = createClient(PEXELS_API_KEY);

export const searchPexelsVideos = async (query: string, limit: number): Promise<Alternative[]> => {
  try {
    const videos = await client.videos.search({ query, per_page: limit });
    if ('error' in videos) {
      throw new Error(videos.error);
    }
    return videos.videos.map(video => ({
      id: video.id,
      title: video.tags.join(', ') || query,
      description: video.tags.join(', '),
      link: video.video_files.find(file => file.quality === 'hd')?.link ?? video.video_files[0].link,
      preview: video.video_files.find(file => file.quality === 'sd')?.link ?? video.video_files[0].link,
      url: video.url,
      thumbnailUrl: video.image,
      topPosition: 1,
      isVisible: true,
      leftPosition: 1,
      offsetStart: 0,
      score: -1,
      duration: video.duration,
      type: 'pexels'
    }));
  } catch (e) {
    logger.info('Issue getting videos from pexels, continuing...', {
      err: (e as Error)?.toString().replace(/error/ig, 'IssUe')
    });
    return [];
  }
};
