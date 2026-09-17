import { UserProfile } from '../models/user-profile';
import { IYoutubeChannel } from 'shared/types';

export class YouTubeUploadRepository {
  async addChannel(firebaseId: string, channel: IYoutubeChannel): Promise<void> {
    await UserProfile.findOneAndUpdate({ firebaseId }, { $push: { youtubeChannels: channel } });
  }

  async removeChannel(firebaseId: string, channelId: string): Promise<void> {
    await UserProfile.findOneAndUpdate({ firebaseId }, { $pull: { youtubeChannels: { channelId } } });
  }

  async updateChannelTokens(
    firebaseId: string,
    channelId: string,
    tokens: { accessToken?: string | null; refreshToken?: string | null; expiresAt?: number | null }
  ): Promise<void> {
    await UserProfile.updateOne(
      { firebaseId, 'youtubeChannels.channelId': channelId },
      {
        $set: {
          'youtubeChannels.$.accessToken': tokens.accessToken,
          'youtubeChannels.$.refreshToken': tokens.refreshToken,
          'youtubeChannels.$.expiresAt': tokens.expiresAt
        }
      }
    );
  }

  async updateChannels(firebaseId: string, channels: IYoutubeChannel[]): Promise<void> {
    await UserProfile.findOneAndUpdate({ firebaseId }, { $set: { youtubeChannels: channels } });
  }
}

export default new YouTubeUploadRepository();
