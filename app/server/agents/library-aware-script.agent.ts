import { libraryVideoSamplingService, VideoSample, SamplingResult } from '../services/library-video-sampling.service';
import { logger } from '../services/logging';


export interface LibraryAwareScriptResult {
  type: 'script' | 'prompt';
  script: string;
  videoSuggestions: string;
}

export async function getSampledLibraryInfo(libraryIds: string[]): Promise<string> {
  // Sample videos from all provided libraries
  const allSamplingResults: SamplingResult[] = [];
  const allVideoSamples: VideoSample[] = [];

  for (const libraryId of libraryIds) {
    try {
      const samplingResult = await libraryVideoSamplingService.sampleVideosFromLibrary(libraryId, {
        maxSamples: 100, // Distribute samples across libraries
        diversityWeight: 0.8 // Favor diversity for script generation
      });

      allSamplingResults.push(samplingResult);
    } catch (error) {
      logger.error('Error sampling from library', { libraryId, error: error });
      // Continue with other libraries
    }
  }

  const subsetOfAllVideoSamples = allSamplingResults.sort(() => Math.random() - 0.5);
  // Create library information summary for the AI
  for (const subset of subsetOfAllVideoSamples) {
    allVideoSamples.push(...subset.videos);
  }

  const videoLibraryInfo = createLibraryInfoSummary(subsetOfAllVideoSamples, allVideoSamples);

  return videoLibraryInfo;
}

function createLibraryInfoSummary(samplingResults: SamplingResult[], videoSamples: VideoSample[]): string {
  const summary: string[] = [];

  // Overall summary
  const totalVideos = samplingResults.reduce((sum, r) => sum + r.totalVideos, 0);
  const strategies = samplingResults.map(r => r.strategy);

  summary.push(`LIBRARY OVERVIEW:`);
  summary.push(`- Total videos across libraries: ${totalVideos}`);
  summary.push(`- Videos sampled for analysis: ${videoSamples.length}`);
  summary.push(`- Sampling strategies used: ${[...new Set(strategies)].join(', ')}`);

  // Cluster information if available
  const clusteredResults = samplingResults.filter(r => r.strategy === 'clustered');
  if (clusteredResults.length > 0) {
    const totalClusters = clusteredResults.reduce((sum, r) => sum + (r.clusterInfo?.totalClusters || 0), 0);
    summary.push(`- Total clusters available: ${totalClusters}`);
  }

  summary.push('');
  summary.push('AVAILABLE VIDEO CONTENT:');

  // Group videos by cluster if available
  const clusteredVideos = videoSamples.filter(v => v.clusterId !== undefined);
  const unclusteredVideos = videoSamples.filter(v => v.clusterId === undefined);

  if (clusteredVideos.length > 0) {
    const clusterGroups = groupVideosByCluster(clusteredVideos);
    const reducedClusters = Object.entries(clusterGroups)
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);

    for (const [clusterId, videos] of reducedClusters) {
      summary.push(`\nCluster ${clusterId} (${videos.length} videos):
        ${videos.map(video => `${video.description}`).join('\n')}
        `);
    }
  }

  if (unclusteredVideos.length > 0) {
    summary.push(`\nOther Available Videos (${unclusteredVideos.length}):`);
    unclusteredVideos
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .forEach((video, idx) => {
        summary.push(`${idx + 1}. ${video.description}`);
      });
    if (unclusteredVideos.length > 8) {
      summary.push(`... and ${unclusteredVideos.length - 8} more videos`);
    }
  }

  summary.push('');
  summary.push('Use this video content to create a script that naturally incorporates these visual elements.');

  return summary.join('\n');
}

function groupVideosByCluster(videos: VideoSample[]): Record<string, VideoSample[]> {
  const groups: Record<string, VideoSample[]> = {};

  for (const video of videos) {
    const clusterId = video.clusterId?.toString() || 'unknown';
    if (!groups[clusterId]) {
      groups[clusterId] = [];
    }
    groups[clusterId].push(video);
  }

  return groups;
}