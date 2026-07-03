import { Segment, WordBaseEdited, Alternative } from '../../../../types/video-ai-data';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../logging';
import { svgInfographicAgent } from '../agents/svg-infographic.agent';
import { getContextForSentence } from './get-sentence-context';
import { renderHtmlToVideo, RenderHtmlToVideoOptions } from './render-html-to-video';
import { uploadToS3 } from '../../../storage/s3';
import { getS3FileUrl } from '../../../../config/storage';
import { safelyDelete } from '../../../fs';
import fs from 'fs';
import type { InfographicPick } from '../agents/infographic-detection.agent';
import { deriveScriptTheme } from './derive-script-theme';

const MIN_INFOGRAPHIC_DURATION = 10;

/**
 * Returns Puppeteer launch config. executablePath falls back to
 * PUPPETEER_EXECUTABLE_PATH env var inside renderHtmlToVideo.
 */
async function resolveChromiumConfig(): Promise<Pick<RenderHtmlToVideoOptions, 'executablePath' | 'browserArgs'>> {
  return {};
}

export async function generateInfographicSegments({
  userId,
  sentences,
  selectedPicks,
  transcript,
  guidance,
  title
}: {
  userId: string;
  sentences: WordBaseEdited[][];
  selectedPicks: InfographicPick[];
  transcript: WordBaseEdited[];
  guidance: string;
  title?: string;
}): Promise<Segment[]> {
  const transcriptText = transcript.map(w => w.punctuated_word ?? w.word).join(' ');
  const [scriptTheme, chromiumConfig] = await Promise.all([
    deriveScriptTheme(transcriptText, title),
    // Resolve once before parallel rendering so the binary is fully written to /tmp
    // before any concurrent spawn — avoids ETXTBSY on Lambda.
    resolveChromiumConfig()
  ]);

  const results = await Promise.allSettled(
    selectedPicks.map(async (pick): Promise<Segment | null> => {
      try {
        const sentence = sentences[pick.sentenceIndex];
        if (!sentence?.length) {
          logger.warn('Infographic pick sentence index out of range', { sentenceIndex: pick.sentenceIndex });
          return null;
        }

        const timeStart = sentence[0]?.start ?? 0;
        let timeEnd = sentence[sentence.length - 1]?.end ?? 0;
        let mergedWords = [...sentence];

        // Extend forward into subsequent sentences until we reach the minimum duration
        let nextIndex = pick.sentenceIndex + 1;
        while (timeEnd - timeStart < MIN_INFOGRAPHIC_DURATION && nextIndex < sentences.length) {
          const nextSentence = sentences[nextIndex];
          if (nextSentence?.length) {
            mergedWords = mergedWords.concat(nextSentence);
            timeEnd = nextSentence[nextSentence.length - 1]?.end ?? timeEnd;
          }
          nextIndex++;
        }

        const duration = Math.max(MIN_INFOGRAPHIC_DURATION, timeEnd - timeStart);
        const formattedSentence = mergedWords.map(w => w.punctuated_word ?? w.word).join(' ');
        const context = getContextForSentence(transcript, timeStart, timeEnd);

        const html = await svgInfographicAgent.invoke({
          script: formattedSentence,
          context,
          dataPoints: pick.dataPoints,
          duration,
          scriptTheme
        });

        const videoPath = await renderHtmlToVideo(html, duration, chromiumConfig);
        try {
          const s3Key = `users/${userId}/svg-infographic-${Date.now()}-${pick.sentenceIndex}.mp4`;
          await uploadToS3(videoPath, s3Key, {
            mimeType: 'video/mp4',
            originalName: s3Key,
            fileSize: fs.statSync(videoPath).size,
            userId
          });
          safelyDelete(videoPath);
          const videoUrl = getS3FileUrl(s3Key);

          const alternative: Alternative = {
            link: videoUrl,
            preview: videoUrl,
            thumbnailUrl: videoUrl,
            title: formattedSentence,
            duration,
            offsetStart: 0,
            isVisible: true,
            isFocused: true,
            score: 100,
            type: 'pinecone',
            id: 0,
            brollType: 'SVG_INFOGRAPHIC'
          };

          const segment: Segment = {
            segmentId: uuidv4(),
            timeStart: Math.max(timeStart, 0),
            timeEnd,
            alternatives: [alternative],
            keywords: `infographic,${pick.dataPoints.join(',')}`
          };
          return segment;
        } catch (uploadErr) {
          safelyDelete(videoPath);
          throw uploadErr;
        }
      } catch (err) {
        logger.warn('Single infographic generation failed', {
          sentenceIndex: pick.sentenceIndex,
          error: err
        });
        console.error(err);
        return null;
      }
    })
  );

  const segments: Segment[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      segments.push(result.value);
    }
  }
  return segments;
}
