import { useMemo } from 'react';
import { HighlightSegment, VideoObject } from '../types';

export const useVideoTimelineRecutter = (highlights: HighlightSegment[], videos: VideoObject[]) => {
  return useMemo(() => calculatePreviewTimeline(videos, highlights), [videos, highlights]);
};

function calculatePreviewTimeline(videos: VideoObject[], highlights: HighlightSegment[]): VideoObject[] {
  if (highlights.length === 0) {
    return videos;
  }
  // Sort videos and highlights by start time
  const sortedVideos = [...videos].sort((a, b) => a.timeStart - b.timeStart);
  const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);

  const previewedVideos: VideoObject[] = [];
  let currentPreviewTime = 0;

  for (const highlight of sortedHighlights) {
    // Find videos that overlap with this highlight segment
    const overlappingVideos = sortedVideos.filter(
      video => !(video.timeEnd <= highlight.start || video.timeStart >= highlight.end)
    );

    for (const video of overlappingVideos) {
      // Check if this video was already added
      const existingVideo = previewedVideos.find(v => v.url === video.url && v.altId === video.altId);

      if (existingVideo) {
        // Extend the existing video's end time if needed
        const newEndTime = currentPreviewTime + Math.min(video.timeEnd, highlight.end) - highlight.start;
        existingVideo.timeEnd = newEndTime;
      } else {
        // Calculate the video's position in the preview timeline
        const videoStartInPreview = Math.max(video.timeStart, highlight.start);
        const videoEndInPreview = Math.min(video.timeEnd, highlight.end);

        const previewStartTime = currentPreviewTime + (videoStartInPreview - highlight.start);
        const previewEndTime = currentPreviewTime + (videoEndInPreview - highlight.start);

        const previewedVideo: VideoObject = {
          ...video,
          originalTimeStart: video.timeStart,
          originalTimeEnd: video.timeEnd,
          timeStart: previewStartTime,
          timeEnd: previewEndTime
        };

        previewedVideos.push(previewedVideo);
      }
    }

    currentPreviewTime += highlight.end - highlight.start;
  }

  return previewedVideos;
}
