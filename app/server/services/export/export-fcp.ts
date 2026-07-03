import { IFCPXML } from '../../types';
import { generateDownloadableTimeline, IntermediaryVideo } from './exporter';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { downloadFile, safelyDeleteDir } from '../fs';
import { archiveDirectory } from '../archiver';
import xml from 'xml';
import { IVideoAIData } from '../../types/video-ai-data';
import { getAudioTrackFromVideo, getMetadata } from '../video-manipulation/ffmpeg';
import { uploadToS3 } from '../storage/s3';
import { ExportJob } from '../../models/export-job';
import { getS3FileUrl } from '../../config/storage';
import { sendData, sendMessage } from '../sockets';
import notificationRepository from '../../repositories/notification.repository';

export function sanitizeString(str: string) {
  // Replace whitespace with a single underscore
  // Remove all characters that are not letters, numbers, or underscore
  return str
    .replace(/\s+/g, '_') // Replace one or more whitespace characters with a single underscore
    .replace(/[^a-zA-Z0-9_]/g, '') // Remove all characters except letters, numbers, and underscore
    .toLowerCase()
    .substring(0, 15); // Optional: convert to lowercase (remove if you want to preserve case)
}

export const generateFCPXML = async (videoAiData: IVideoAIData, jobId: string, userId: string): Promise<void> => {
  const folderKey = uuidv4();
  const folderPath = `/tmp/data/${folderKey}`;
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    if (!fs.existsSync(folderPath + '-zip')) {
      fs.mkdirSync(folderPath + '-zip', { recursive: true });
    }

    sendMessage(userId, jobId, "Our intern is getting all the CDs with your project's footage.", 10);
    const { downloadedVideos, downloadedSource } = await generateDownloadableTimeline(
      videoAiData,
      videoAiData.highlightSegments ?? [],
      userId
    );
    let downloadedAudio: { MP3: string; WAV: string } | null = null;
    const sourceName = downloadedSource.split('/').pop()?.split('?')[0] ?? 'source.mp4';
    const sourceLocalPath = `${folderPath}/${sourceName}`;
    await downloadFile(sourceLocalPath, downloadedSource);
    const sourceMetadata = await getMetadata(sourceLocalPath);
    const videoStream = sourceMetadata.streams.find(stream => stream.codec_type === 'video');
    const sourceFrameRateRaw = videoStream?.r_frame_rate;
    const sourceFramerate =
      (Number(sourceFrameRateRaw?.split('/')[0]) ?? 24) / (Number(sourceFrameRateRaw?.split('/')[1]) ?? 1);
    const sourceDuration = Number(videoStream?.nb_frames ?? 1000);
    const sourceAudio = sourceMetadata.streams.find(stream => stream.codec_type === 'audio');

    const { downloadedVideos: downloadedTimeline1 } = await generateDownloadableTimeline(
      videoAiData,
      videoAiData.highlightSegments ?? [],
      userId,
      undefined,
      undefined,
      1
    );

    const { downloadedVideos: downloadedTimeline2 } = await generateDownloadableTimeline(
      videoAiData,
      videoAiData.highlightSegments ?? [],
      userId,
      undefined,
      undefined,
      2
    );
    sendMessage(userId, jobId, "He's now transferring the footage to his hard drive.", 20);
    let downloadedVideoCount = 0;
    const totalVideosCount = downloadedVideos.length + downloadedTimeline1.length + downloadedTimeline2.length;
    const locallyDownloadedVideos = await Promise.all(
      downloadedVideos.map(async video => {
        const result = await mapDownloadedVideo(video, sourceFramerate, folderPath);

        sendMessage(
          userId,
          jobId,
          `Progress! Loaded ${++downloadedVideoCount} of ${totalVideosCount} CDs.`,
          20 + 70 * (downloadedVideoCount / totalVideosCount)
        );

        return result;
      })
    );
    const locallyDownloadedVideos1 = await Promise.all(
      downloadedTimeline1.map(async video => {
        const result = await mapDownloadedVideo(video, sourceFramerate, folderPath);

        sendMessage(
          userId,
          jobId,
          `Progress! Loaded ${++downloadedVideoCount} of ${totalVideosCount} CDs.`,
          20 + 70 * (downloadedVideoCount / totalVideosCount)
        );

        return result;
      })
    );
    const locallyDownloadedVideos2 = await Promise.all(
      downloadedTimeline2.map(async video => {
        const result = await mapDownloadedVideo(video, sourceFramerate, folderPath);

        sendMessage(
          userId,
          jobId,
          `Progress! Loaded ${++downloadedVideoCount} of ${totalVideosCount} CDs.`,
          20 + 70 * (downloadedVideoCount / totalVideosCount)
        );

        return result;
      })
    );
    sendMessage(userId, jobId, 'Alright, the footage is there, time to record some music from the radio.', 95);
    let musicPath = '';
    let musicName = '';
    let musicTrackIndex = 0;
    let musicFramerate = 0;
    let musicChannels = 0;

    let audioPath = '';
    let audioName = '';
    let audioTrackIndex = 0;
    audioName = `source.mp3`;
    audioPath = `${folderPath}/${audioName}`;
    await getAudioTrackFromVideo(sourceLocalPath, audioPath);
    const audioMetadata = await getMetadata(audioPath);

    audioTrackIndex = audioMetadata.streams.findIndex(stream => stream.codec_type === 'audio');
    const audioChannels = audioMetadata.streams.find(stream => stream.codec_type === 'audio')?.channels ?? 2;

    const timelineTracks = [
      {
        track: generateTrackFromDownloadedMedia(locallyDownloadedVideos)
      }
    ];

    if (downloadedTimeline1.length > 0) {
      timelineTracks.push({
        track: generateTrackFromDownloadedMedia(locallyDownloadedVideos1)
      });
    }
    if (downloadedTimeline2.length > 0) {
      timelineTracks.push({
        track: generateTrackFromDownloadedMedia(locallyDownloadedVideos2)
      });
    }
    const timelineXml: IFCPXML = {
      xmeml: [
        { _attr: { version: '5' } },
        {
          sequence: [
            { name: 'Sequence 1' },
            { duration: sourceDuration },
            { rate: [{ timebase: sourceFramerate }, { ntsc: 'FALSE' }] },
            { in: -1 },
            { out: -1 },
            {
              timecode: [
                { string: '00:00:00:00' },
                { frame: 0 },
                { displayformat: 'NDF' },
                { rate: [{ timebase: sourceFramerate }, { ntsc: 'FALSE' }] }
              ]
            },
            {
              media: [
                {
                  video: [
                    {
                      track: [
                        {
                          clipitem: [
                            { _attr: { id: 'Source 0' } },
                            { name: 'Source' },
                            { duration: sourceDuration },
                            { start: 0 },
                            { end: sourceDuration },
                            { enabled: 'TRUE' },
                            { in: 0 },
                            { out: sourceDuration },
                            {
                              file: [
                                { _attr: { id: 'Source 2' } },
                                { duration: sourceDuration },
                                {
                                  rate: [{ timebase: sourceFramerate }, { ntsc: 'FALSE' }]
                                },
                                {
                                  media: [
                                    {
                                      video: [
                                        { duration: sourceDuration },
                                        {
                                          samplecharacteristics: [
                                            { width: videoStream?.width ?? 1920 },
                                            { height: videoStream?.height ?? 1080 }
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                },
                                { name: 'Source' },
                                { pathurl: sourceName }
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    ...(timelineTracks as any).reverse(),
                    {
                      format: [
                        {
                          samplecharacteristics: [
                            { width: '1920' },
                            { height: '1080' },
                            { pixelaspectratio: 'square' },
                            {
                              rate: [{ timebase: '24' }, { ntsc: 'FALSE' }]
                            },
                            {
                              codec: [
                                {
                                  appspecificdata: [
                                    { appname: 'Final Cut Pro' },
                                    { appmanufacturer: 'Apple Inc.' },
                                    {
                                      data: [{ qtcodec: '' }]
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ] as any
                },
                {
                  audio: [
                    {
                      track: [
                        {
                          clipitem: [
                            { _attr: { id: `Source Audio 0` } },
                            { name: videoAiData.title },
                            { duration: sourceDuration },
                            { start: 0 },
                            { end: sourceDuration },
                            { enabled: 'TRUE' },
                            { in: 0 },
                            { out: sourceDuration },
                            {
                              sourcetrack: [
                                {
                                  mediatype: 'audio'
                                },
                                {
                                  trackindex: audioTrackIndex + 1
                                }
                              ]
                            },
                            {
                              file: [
                                { _attr: { id: 'Source Audio 2' } },
                                { duration: sourceDuration },
                                { name: 'Source Audio' },
                                {
                                  rate: [{ timebase: sourceFramerate }, { ntsc: 'FALSE' }]
                                },
                                {
                                  media: [{ audio: [{ channelcount: audioChannels }] }]
                                },
                                { pathurl: audioName }
                              ]
                            }
                          ]
                        },
                        { enabled: 'TRUE' },
                        { locked: 'FALSE' }
                      ]
                    },
                    ...(videoAiData.audio[videoAiData.audioIndex] && musicName
                      ? ([
                          {
                            track: [
                              {
                                clipitem: [
                                  { _attr: { id: `${videoAiData.audio[videoAiData.audioIndex].title} 0` } },
                                  { name: videoAiData.audio[videoAiData.audioIndex].title },
                                  { duration: sourceDuration },
                                  { start: 0 },
                                  { end: sourceDuration },
                                  { enabled: videoAiData.audioEnabled ? 'TRUE' : 'FALSE' },
                                  { in: 0 },
                                  { out: sourceDuration },
                                  {
                                    sourcetrack: [
                                      {
                                        mediatype: 'audio'
                                      },
                                      {
                                        trackindex: musicTrackIndex + 1
                                      }
                                    ]
                                  },
                                  {
                                    filter: [
                                      { enabled: 'TRUE' },
                                      { start: 0 },
                                      { end: sourceDuration },
                                      {
                                        effect: [
                                          { name: 'Audio Levels' },
                                          { effectid: 'audiolevels' },
                                          { effecttype: 'audiolevels' },
                                          { mediatype: 'audio' },
                                          { effectcategory: 'audiolevels' },
                                          {
                                            parameter: [
                                              { name: 'Level' },
                                              { parameterid: 'level' },
                                              { value: videoAiData.audioVolume },
                                              { valuemin: '0' },
                                              { valuemax: '3.98109' }
                                            ]
                                          }
                                        ]
                                      }
                                    ]
                                  },
                                  {
                                    file: [
                                      { _attr: { id: `${videoAiData.audio[videoAiData.audioIndex].title} 3` } },
                                      { duration: sourceDuration },
                                      {
                                        rate: [{ timebase: musicFramerate }, { ntsc: 'FALSE' }]
                                      },
                                      {
                                        media: [{ audio: [{ channelcount: musicChannels }] }]
                                      },
                                      { name: 'music' },
                                      { pathurl: musicName }
                                    ]
                                  }
                                ]
                              },
                              { enabled: 'TRUE' },
                              { locked: 'FALSE' }
                            ]
                          }
                        ] as any[])
                      : [])
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    fs.writeFileSync(
      `${folderPath}/${sanitizeString(videoAiData.title ?? 'video')}.xml`,
      xml(timelineXml as any, { indent: '  ' }) as string
    );

    sendMessage(userId, jobId, 'Wrapping up in  a nice little envelope.', 97);
    const zipPath = `${folderPath}-zip/${folderKey}.zip`;
    await archiveDirectory(folderPath, zipPath);

    sendMessage(userId, jobId, 'Strapping to the back of a carrier pigeon.', 98);
    const uploadKey = `users/${userId}/exports/${sanitizeString(videoAiData.title ?? 'video')}-${folderKey}.zip`;
    await uploadToS3(
      zipPath,
      uploadKey,
      {
        mimeType: 'application/zip',
        originalName: `${sanitizeString(videoAiData.title ?? 'video')}-${folderKey}.zip`,
        userId,
        fileSize: fs.statSync(zipPath).size
      },
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 1)
    );

    sendMessage(userId, jobId, 'Done, the FCPXML is ready to be downloaded.', 99);
    const zipUploadUrl = getS3FileUrl(uploadKey);

    await ExportJob.updateOne({ _id: jobId }, { $set: { status: 'COMPLETED', videoUrl: zipUploadUrl } });
    await sendData(userId, jobId, { isExport: true, _id: jobId });
    await notificationRepository.create({
      userId,
      type: 'EXPORT_COMPLETE',
      title: 'Export Complete!',
      message: 'Your export for ' + (videoAiData.title ?? 'Untitled Video') + ' is ready to download!',
      links: [{ linkType: 'EXPORT', docId: jobId }]
    });
  } finally {
    safelyDeleteDir(folderPath);
    safelyDeleteDir(folderPath + '-zip');
  }
};

async function mapDownloadedVideo(video: IntermediaryVideo, sourceFramerate: number, folderPath: string) {
  const videoName = video.downloadLink?.split('/').pop()?.split('?')[0];
  if (!videoName) {
    return null;
  }
  const videoPath = `${folderPath}/${videoName}`;
  await downloadFile(videoPath, video.downloadLink);
  const metadata = await getMetadata(videoPath);
  const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
  const framerateRaw = videoStream?.r_frame_rate;
  const framerate = (Number(framerateRaw?.split('/')[0]) ?? 24) / (Number(framerateRaw?.split('/')[1]) ?? 1);
  const startFrame = Math.round(video.timeStart * sourceFramerate);
  const endFrame = Math.round(video.timeEnd * sourceFramerate);
  const inFrame = 0;
  const outFrame = Math.round((video.timeEnd - video.timeStart) * framerate);
  const duration = Number(videoStream?.nb_frames ?? 0);
  return {
    ...video,
    videoPath,
    videoName,
    metadata,
    framerate,
    startFrame,
    endFrame,
    duration,
    inFrame,
    outFrame,
    width: videoStream?.width ?? 1920,
    height: videoStream?.height ?? 1080
  };
}

function generateTrackFromDownloadedMedia(locallyDownloadedVideos: Awaited<ReturnType<typeof mapDownloadedVideo>>[]) {
  return locallyDownloadedVideos
    .filter(v => v !== null)
    .map((video, index) => ({
      clipitem: [
        { _attr: { id: `${video.videoName} ${index}` } },
        { name: video.videoName ?? `${video.videoName} ${index}` },
        { duration: video.duration },
        { start: video.startFrame },
        { end: video.endFrame },
        { enabled: 'TRUE' },
        { in: video.inFrame },
        { out: video.outFrame },
        {
          file: [
            { _attr: { id: `${video.videoName} ${index}-2` } },
            { duration: video.duration },
            {
              rate: [{ timebase: video.framerate }, { ntsc: 'FALSE' }]
            },
            {
              media: [
                {
                  video: [
                    { duration: video.duration },
                    { samplecharacteristics: [{ width: video.width }, { height: video.height }] }
                  ]
                }
              ]
            },
            { name: video.videoName ?? `${video.videoName} ${index}` },
            { pathurl: video.videoName! }
          ]
        }
      ]
    }));
}
