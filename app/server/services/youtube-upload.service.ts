import { youtube } from 'googleapis/build/src/apis/youtube';
import { auth } from 'googleapis/build/src/apis/oauth2';
import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, API_URL, CLIENT_URL } from '../config/const';
import { toInternalMediaUrl } from '../config/storage';
import { logger } from './logging';
import { BadRequestError } from '../errors/BadRequestError';
import { NotFoundError } from '../errors/NotFoundError';
import youtubeUploadRepository from '../repositories/youtube-upload.repository';
import userProfileRepository from '../repositories/user-profile.repository';
import notificationRepository from '../repositories/notification.repository';
import { ExportJob } from '../models/export-job';
import { VideoAIData } from '../models/video-ai-data';
import { IYoutubeChannel } from 'shared/types';

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];

const REDIRECT_URI = `${API_URL}/api/youtube/callback`;

export class YouTubeUploadService {
  private createAuthClient(credentials?: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }) {
    const oauth2Client = new auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, REDIRECT_URI);
    if (credentials) {
      oauth2Client.setCredentials(credentials);
    }
    return oauth2Client;
  }

  async refreshTokenForChannel(channel: IYoutubeChannel) {
    const authClient = this.createAuthClient({
      refresh_token: channel.refreshToken,
      access_token: channel.accessToken,
      expiry_date: channel.expiresAt
    });

    const { credentials } = await authClient.refreshAccessToken();

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || channel.refreshToken,
      expiresAt: credentials.expiry_date
    };
  }

  /**
   * `state` round-trips through Google's redirect, so identifying the user this way
   * (rather than requiring an Authorization header, which a full-page redirect can't send)
   * matches how Google's OAuth flow has to work.
   */
  generateAuthUrl(userId: string, returnPath: string = '/') {
    const state = Buffer.from(JSON.stringify({ userId, returnPath })).toString('base64');

    return this.createAuthClient().generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state,
      redirect_uri: REDIRECT_URI,
      prompt: 'consent' // force a refresh_token on every connect
    });
  }

  async handleCallback(code: string, state: string) {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { userId, returnPath } = stateData;

    if (!userId) {
      throw new BadRequestError('Invalid state parameter');
    }

    const oauth2Client = this.createAuthClient();
    const { tokens } = await oauth2Client.getToken({ code, redirect_uri: REDIRECT_URI });

    const authClient = this.createAuthClient(tokens);
    const yt = youtube('v3');
    const channelResponse = await yt.channels.list({ part: ['snippet'], mine: true, auth: authClient });

    const channel = channelResponse.data.items?.[0];
    if (!channel?.id) {
      throw new NotFoundError('Could not fetch channel information');
    }

    await youtubeUploadRepository.removeChannel(userId, channel.id);
    await youtubeUploadRepository.addChannel(userId, {
      channelId: channel.id,
      channelTitle: channel.snippet?.title || 'YouTube Channel',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date
    });

    return `${CLIENT_URL}${returnPath || '/'}`;
  }

  async getChannels(userId: string) {
    const user = await userProfileRepository.findByFirebaseId(userId);

    if (!user?.youtubeChannels?.length) {
      return { channels: [] as IYoutubeChannel[] };
    }

    const refreshedChannels = (
      await Promise.all(
        user.youtubeChannels.map(async channel => {
          if (channel.expiresAt && channel.expiresAt <= Date.now()) {
            try {
              const newTokens = await this.refreshTokenForChannel(channel);
              await youtubeUploadRepository.updateChannelTokens(userId, channel.channelId, newTokens);
              return { ...channel, ...newTokens };
            } catch (error) {
              logger.error('Failed to refresh YouTube token for channel', { channelId: channel.channelId, error });
              return null;
            }
          }
          return channel;
        })
      )
    ).filter((channel): channel is IYoutubeChannel => channel !== null);

    if (refreshedChannels.length !== user.youtubeChannels.length) {
      await youtubeUploadRepository.updateChannels(userId, refreshedChannels);
    }

    return {
      channels: refreshedChannels.map(({ channelId, channelTitle }) => ({ channelId, channelTitle }))
    };
  }

  async removeChannel(userId: string, channelId: string) {
    await youtubeUploadRepository.removeChannel(userId, channelId);
  }

  async uploadVideo(
    userId: string,
    videoData: { videoUrl: string; videoTitle: string; description?: string; channelId: string },
    isPublic: boolean = false
  ) {
    const { videoUrl, videoTitle, description, channelId } = videoData;

    if (!videoUrl || !videoTitle || !channelId) {
      throw new BadRequestError('Video URL, title, and channel ID are required');
    }

    const user = await userProfileRepository.findByFirebaseId(userId);
    const channel = user?.youtubeChannels?.find(ch => ch.channelId === channelId);

    if (!channel) {
      return { success: false as const, error: 'Selected YouTube channel not found', needsAuth: true };
    }

    const tempFilePath = path.join(os.tmpdir(), `youtube-upload-${uuidv4()}.mp4`);

    try {
      // videoUrl is the browser-facing MEDIA_BASE_URL link; under docker compose that
      // host doesn't resolve from inside the server container, so fetch it server-side
      // via the internal MinIO endpoint instead (same rewrite exporter.ts/fs.ts use).
      const response = await axios({ url: toInternalMediaUrl(videoUrl), method: 'GET', responseType: 'stream' });
      await pipeline(response.data, fs.createWriteStream(tempFilePath));

      const authClient = this.createAuthClient({
        access_token: channel.accessToken,
        refresh_token: channel.refreshToken,
        expiry_date: channel.expiresAt
      });

      const yt = youtube('v3');
      const result = await yt.videos.insert({
        part: ['snippet', 'status'],
        auth: authClient,
        requestBody: {
          snippet: {
            title: videoTitle,
            description: description || 'Uploaded via RealityCuts'
          },
          status: {
            // Manual uploads always land private, reviewable before the user
            // publishes them; automations opt into public via isPublic.
            privacyStatus: isPublic ? 'public' : 'private'
          }
        },
        media: {
          body: fs.createReadStream(tempFilePath)
        }
      });

      return {
        success: true as const,
        videoId: result.data.id,
        youtubeUrl: `https://www.youtube.com/watch?v=${result.data.id}`
      };
    } catch (error: any) {
      logger.error('Error uploading to YouTube', { Error: error, 'User ID': userId });

      if (error?.response?.status === 401) {
        return { success: false as const, error: 'YouTube authorization expired', needsAuth: true };
      }

      throw new Error('Failed to upload video to YouTube');
    } finally {
      await fs.promises.rm(tempFilePath, { force: true }).catch(() => {});
    }
  }

  /**
   * Uploads a finished export to YouTube on behalf of an automation. Triggered by
   * export-processor.ts once `job.youtubeUpload.channelId` is set (see
   * automation-checker.service.ts, which is what actually opts an export into this).
   * Bails silently if the job was never tagged for upload — this lets the same export
   * pipeline serve both automation and manual (button-triggered) exports.
   */
  async uploadCompletedExport(exportJobId: string): Promise<void> {
    const job = await ExportJob.findById(exportJobId);
    if (!job?.youtubeUpload?.channelId) return;

    const userId = job.userId;
    const videoAiData = job.videoDataId ? await VideoAIData.findById(job.videoDataId) : null;
    const videoTitle = job.youtubeUpload.title || videoAiData?.title || 'Untitled video';
    const isPublic = job.youtubeUpload.isPublic ?? false;

    const result = await this.uploadVideo(
      userId,
      {
        videoUrl: job.videoUrl,
        videoTitle,
        description: job.youtubeUpload.description,
        channelId: job.youtubeUpload.channelId
      },
      isPublic
    );

    if (!result.success) {
      logger.error('Automated YouTube upload failed', { exportJobId, userId, error: result.error });
      await notificationRepository.create({
        userId,
        type: 'YOUTUBE_UPLOAD_FAILED',
        title: 'YouTube upload failed',
        message: result.needsAuth
          ? 'Your YouTube channel needs to be reconnected before automations can keep uploading to it.'
          : 'Your automated video could not be uploaded to YouTube. It is still available to download.',
        links: [{ linkType: 'EXPORT', docId: exportJobId }]
      });
      return;
    }

    job.youtubeUpload.uploadedUrl = result.youtubeUrl;
    await job.save();

    await notificationRepository.create({
      userId,
      type: 'YOUTUBE_UPLOAD_COMPLETE',
      title: 'Uploaded to YouTube',
      message: `"${videoTitle}" was uploaded to YouTube as ${isPublic ? 'public' : 'private'}: ${result.youtubeUrl}`,
      links: [{ linkType: 'EXPORT', docId: exportJobId }]
    });
  }
}

const youtubeUploadService = new YouTubeUploadService();
export default youtubeUploadService;

// Named export so BullMQ's lazy-import worker handlers (see bullmq/workers.ts) can
// pull this in without needing default-export destructuring on a dynamic import.
export const uploadCompletedExport = (exportJobId: string) => youtubeUploadService.uploadCompletedExport(exportJobId);
