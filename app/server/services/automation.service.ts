import userProfileRepository from '../repositories/user-profile.repository';
import automationConfigRepository from '../repositories/automation-config.repository';
import transcriptionJobRepository from '../repositories/transcription-job.repository';
import { IAutomationConfig, IAutomationSource, ITranscriptionJob, ITestGenerationRequest } from '../types';
import { BadRequestError, ForbiddenError } from '../errors';
import { enqueueLambdaVideoGenerationTask } from './task-queue';
import { VideoGenerationEventDataV3 } from 'shared/types/event-contracts';
import {
  getAutomationLimits,
  canCreateAutomation,
  getRemainingAutomationSlots,
  AutomationLimits
} from 'shared/utils/automation';
import * as automationSourceService from './automation-source.service';
import { logger } from './logging';
import { AutomationConfig } from '../models/automation-config';
import automationScriptRepository from '../repositories/automation-script.repository';

export interface AutomationLimitsInfo {
  limits: AutomationLimits;
  current: { daily: number; weekly: number };
  remaining: AutomationLimits;
  canCreateDaily: boolean;
  canCreateWeekly: boolean;
}

function activeAutomationSources(sources: IAutomationSource[] | undefined): IAutomationSource[] {
  return (sources ?? []).filter(s => !!s.uploadId && !s.isDeleted);
}

export class AutomationService {
  async getUserAutomationLimits(userId: string): Promise<AutomationLimitsInfo> {
    const userProfile = await userProfileRepository.findByFirebaseId(userId);
    if (!userProfile) {
      throw new BadRequestError('User profile not found');
    }

    const existingCounts = await automationConfigRepository.countAutomationsByType(userId);
    const limits = getAutomationLimits(userProfile.entitlements ?? []);
    const remaining = getRemainingAutomationSlots(userProfile.entitlements ?? [], existingCounts);

    return {
      limits,
      current: existingCounts,
      remaining,
      canCreateDaily: canCreateAutomation(userProfile.entitlements ?? [], existingCounts, 'DAILY'),
      canCreateWeekly: canCreateAutomation(userProfile.entitlements ?? [], existingCounts, 'WEEKLY')
    };
  }

  async validateAutomationCreation(userId: string, scheduleType: 'DAILY' | 'WEEKLY'): Promise<void> {
    const userProfile = await userProfileRepository.findByFirebaseId(userId);
    if (!userProfile) {
      throw new BadRequestError('User profile not found');
    }

    const existingCounts = await automationConfigRepository.countAutomationsByType(userId);

    if (!canCreateAutomation(userProfile.entitlements ?? [], existingCounts, scheduleType)) {
      const limits = getAutomationLimits(userProfile.entitlements ?? []);
      const scheduleTypeLower = scheduleType.toLowerCase();
      throw new ForbiddenError(
        `You have reached your ${scheduleTypeLower} automation limit. ` +
          `Current limit: ${limits[scheduleTypeLower as keyof typeof limits]} ${scheduleTypeLower} automation(s). ` +
          `Upgrade your plan to create more automations.`
      );
    }
  }

  async getUserAutomationConfigs(userId: string): Promise<IAutomationConfig[] | undefined> {
    return await automationConfigRepository.findByUserId(userId);
  }

  async getAllAutomationsForAdmin(
    skip: number,
    limit: number
  ): Promise<{ automations: IAutomationConfig[]; total: number }> {
    return await automationConfigRepository.getAllForAdmin(skip, limit);
  }

  async getAutomationConfigById(id: string): Promise<IAutomationConfig | null> {
    return await automationConfigRepository.findById(id);
  }

  async getAutomationConfigByChannelId(channelId: string): Promise<IAutomationConfig | null> {
    return await automationConfigRepository.findByChannelId(channelId);
  }

  async getAllAutomationConfigsByChannelId(channelId: string): Promise<IAutomationConfig[]> {
    return await automationConfigRepository.findAllByChannelId(channelId);
  }

  async createAutomationConfig(userId: string, configData: any): Promise<IAutomationConfig> {
    // Validate theme
    if (!configData.contentSettings?.theme) {
      throw new BadRequestError('Content theme is required');
    }

    if (!configData.schedule?.type || !['DAILY', 'WEEKLY'].includes(configData.schedule.type)) {
      throw new BadRequestError('Valid schedule type (DAILY or WEEKLY) is required');
    }

    // Removed the check for existing config to allow multiple automations per channel
    // Multiple automations per channel are now supported

    // Validate automation limits
    await this.validateAutomationCreation(userId, configData.schedule.type);

    // Create the config
    const dataWithUserId = {
      ...configData,
      userId
    };

    const created = await automationConfigRepository.create(dataWithUserId);
    await this.syncAutomationSourcesAfterSave(userId, created, null);
    return created;
  }

  private async syncAutomationSourcesAfterSave(
    userId: string,
    newConfig: IAutomationConfig,
    previous: IAutomationConfig | null | undefined
  ): Promise<void> {
    const prev = activeAutomationSources(previous?.contentSettings?.sources);
    const next = activeAutomationSources(newConfig.contentSettings?.sources);
    const prevIds = new Set(prev.map(s => s.uploadId!));
    const nextIds = new Set(next.map(s => s.uploadId!));
    const configId = newConfig._id.toString();
    const theme = newConfig.contentSettings?.theme || '';

    for (const p of prev) {
      if (!nextIds.has(p.uploadId!)) {
        await automationSourceService.removeAutomationSourceArtifacts(
          userId,
          configId,
          p.uploadId!,
          p.fileUrl
        );
      }
    }

    for (const n of next) {
      if (!n.uploadId) continue;
      const wasActiveBefore = prevIds.has(n.uploadId);
      const isTemp = !n.fileUrl || n.fileUrl.includes('/temp-uploads/');
      if (!wasActiveBefore || isTemp) {
        try {
          await automationSourceService.finalizeAndEnqueueSource(userId, configId, n.uploadId, theme);
        } catch (e) {
          logger.error('Failed to finalize/enqueue automation PDF source', {
            configId,
            uploadId: n.uploadId,
            error: e instanceof Error ? e.message : e
          });
          await AutomationConfig.updateOne(
            { _id: newConfig._id },
            {
              $set: {
                'contentSettings.sources.$[s].status': 'failed',
                'contentSettings.sources.$[s].error': e instanceof Error ? e.message : 'Unknown error'
              }
            },
            { arrayFilters: [{ 's.uploadId': n.uploadId }] }
          );
        }
      }
    }
  }

  async updateAutomationConfigById(id: string, updates: any, userId: string): Promise<IAutomationConfig | null> {
    const existing = await automationConfigRepository.findById(id);
    if (!existing) {
      return null;
    }
    if (existing.userId !== userId) {
      throw new ForbiddenError('You do not have access to this automation');
    }
    const updated = await automationConfigRepository.updateById(id, updates);
    if (updated) {
      await this.syncAutomationSourcesAfterSave(userId, updated, existing);
    }
    return updated;
  }

  async updateAutomationConfig(channelId: string, updates: any, userId: string): Promise<IAutomationConfig | null> {
    const existing = await automationConfigRepository.findByChannelId(channelId);
    if (!existing) {
      return null;
    }
    if (existing.userId !== userId) {
      throw new ForbiddenError('You do not have access to this automation');
    }
    const updated = await automationConfigRepository.update(channelId, updates);
    if (updated) {
      await this.syncAutomationSourcesAfterSave(userId, updated, existing);
    }
    return updated;
  }

  async reprocessAutomationSource(userId: string, configId: string, uploadId: string): Promise<void> {
    const config = await automationConfigRepository.findById(configId);
    if (!config || config.userId !== userId) {
      throw new ForbiddenError('You do not have access to this automation');
    }
    const theme = config.contentSettings?.theme || '';
    await automationSourceService.reprocessAutomationSource(userId, configId, uploadId, theme);
  }

  async deleteScriptsBySource(userId: string, configId: string, uploadId: string): Promise<number> {
    const config = await automationConfigRepository.findById(configId);
    if (!config || config.userId !== userId) {
      throw new ForbiddenError('You do not have access to this automation');
    }

    const sourceExists = (config.contentSettings?.sources ?? []).some(s => s.uploadId === uploadId);
    if (!sourceExists) {
      throw new BadRequestError('Source not found in automation');
    }

    return automationScriptRepository.softDeleteByAutomationAndSource(configId, uploadId);
  }

  async deleteAutomationConfigById(id: string): Promise<boolean> {
    return await automationConfigRepository.deleteById(id);
  }

  async deleteAutomationConfig(channelId: string): Promise<boolean> {
    return await automationConfigRepository.delete(channelId);
  }

  async getActiveAutomationConfigs(): Promise<IAutomationConfig[]> {
    return await automationConfigRepository.findActive();
  }

  async toggleAutomationConfigById(id: string, isEnabled: boolean): Promise<IAutomationConfig | null> {
    if (typeof isEnabled !== 'boolean') {
      throw new BadRequestError('isEnabled must be a boolean value');
    }

    return await automationConfigRepository.updateById(id, {
      isEnabled,
      status: isEnabled ? 'ACTIVE' : 'PAUSED'
    });
  }

  async toggleAutomationConfig(channelId: string, isEnabled: boolean): Promise<IAutomationConfig | null> {
    if (typeof isEnabled !== 'boolean') {
      throw new BadRequestError('isEnabled must be a boolean value');
    }

    return await automationConfigRepository.update(channelId, {
      isEnabled,
      status: isEnabled ? 'ACTIVE' : 'PAUSED'
    });
  }

  async testVideoGeneration(userId: string, params: ITestGenerationRequest): Promise<string> {
    const tjobj: Partial<ITranscriptionJob> = {
      userId: userId,
      includeMusic: params.includeMusic || false,
      brollDuration: params.brollDuration || 3.5,
      jobType: 'SCRIPT',
      status: 'VIDEO_RECEIVED'
    };

    const tj = await transcriptionJobRepository.create(tjobj);
    const tjId = tj._id!.toString();

    const videoGenerationEventData: VideoGenerationEventDataV3 = {
      guidance: params.theme,
      userId: userId,
      isTalkingHead: params.isTalkingHead || false,
      includeMusic: params.includeMusic || false,
      tjId,
      title: '',
      brollDuration: params.brollDuration || 3.5,
      privateLibraryIds: params.privateLibraryIds || [],
      publicLibraryIds: params.publicLibraryIds || [],
      isVoicePremium: params.isVoicePremium || false,
      voiceType: params.voiceType || 'alloy',
      size: params.size || '1080p',
      uploadType: 'prompt',
      historyKey: params.channelId,
      libraries: {
        pexels: params.libraries?.pexels || false
      },
      orientation: params.orientation || 'VERTICAL',
      version: '3.0.0',
      language: params.language || 'en',
      isAllPublicLibrariesSelected: params.isAllPublicLibrariesSelected || false,
      captions: params.captions,
      script: params.theme
    };
    // Send video generation event
    await enqueueLambdaVideoGenerationTask(videoGenerationEventData);

    return tjId;
  }
}

export default new AutomationService();
