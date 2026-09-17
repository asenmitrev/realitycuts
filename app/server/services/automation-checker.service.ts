/**
 * Automation checker — periodic scan for due AutomationConfigs.
 *
 * Ported from the deleted `functions/automation-checker` Lambda (removed
 * along with the rest of the AWS/CDK infra). The old EventBridge rule fired
 * this every 5 minutes; it is now invoked the same way by a BullMQ
 * repeatable job (see bullmq/workers.ts `scheduleAutomationCheckerJob`).
 *
 * The old checker also gated execution on an active "Done For You" Stripe
 * subscription. `isDoneForYou()` is now a hardcoded stub that always
 * returns true on this self-hosted branch, so that gate was dropped here.
 * The `contentType` field the old checker used to pick between
 * prompt/script/music generation no longer exists on AutomationConfig —
 * every automation now goes through the same script/theme path already
 * used by `AutomationService.testVideoGeneration`, falling back to the
 * queued PDF-source script when one is available.
 */

import { logger } from './logging';
import automationConfigRepository, { type DueAutomation } from '../repositories/automation-config.repository';
import userProfileRepository from '../repositories/user-profile.repository';
import notificationRepository from '../repositories/notification.repository';
import transcriptionJobRepository from '../repositories/transcription-job.repository';
import automationScriptRepository from '../repositories/automation-script.repository';
import { enqueueLambdaVideoGenerationTask } from './task-queue';
import type { VideoGenerationEventDataV3 } from 'shared/types/event-contracts';
import type { ExportJob } from 'shared/types';
import type { IAutomationConfig, ITranscriptionJob, IUserProfileWithMethods } from '../types';

export async function checkDueAutomations(): Promise<void> {
  logger.info('Automation checker: looking for due automations');

  const dueAutomations = await automationConfigRepository.findDueAutomations();

  if (dueAutomations.length === 0) {
    logger.info('Automation checker: no automations due at this time');
    return;
  }

  for (const automation of dueAutomations) {
    await processDueAutomation(automation);
  }

  logger.info('Automation checker: completed', { count: dueAutomations.length });
}

async function processDueAutomation(automation: DueAutomation): Promise<void> {
  const configId = automation.config._id?.toString() || '';

  const hasLibraries =
    (automation.config.contentSettings?.privateLibraryIds?.length ?? 0) > 0 ||
    (automation.config.contentSettings?.publicLibraryIds?.length ?? 0) > 0 ||
    automation.config.contentSettings?.allPublicLibrariesSelected === true;

  if (!hasLibraries) {
    logger.info('Automation has no libraries selected and will be disabled', { configId });
    await notificationRepository.create({
      userId: automation.config.userId,
      type: 'AUTOMATION_FAILED',
      title: `Automation ${automation.config.contentSettings?.theme || ''} has no libraries selected and will be disabled`,
      message: 'Please edit the automation and select libraries to continue using the service.',
      links: []
    });
    await automationConfigRepository.updateById(configId, { isEnabled: false });
    return;
  }

  const userProfile = await userProfileRepository.findByFirebaseId(automation.config.userId);
  if (!userProfile) {
    logger.error('User profile not found for automation, disabling', { userId: automation.config.userId, configId });
    await automationConfigRepository.updateById(configId, { isEnabled: false });
    return;
  }

  if (userProfile.getTTSMinutesRemaining() <= 0) {
    logger.error('No TTS minutes remaining for user, disabling automation', { userId: automation.config.userId, configId });
    await notificationRepository.create({
      userId: automation.config.userId,
      type: 'AUTOMATION_FAILED',
      title: `Your profile has no TTS minutes remaining and ${automation.config.contentSettings?.theme || 'automation'} will be disabled`,
      message: 'Your TTS minutes reset at the beginning of your next billing period.',
      links: []
    });
    await automationConfigRepository.updateById(configId, { isEnabled: false });
    return;
  }

  for (const timeSlot of automation.dueTimeSlots) {
    try {
      const sent = await sendVideoGenerationEvent(automation.config, userProfile);
      if (sent) {
        await automationConfigRepository.markTimeSlotAsProcessedById(configId, timeSlot.hour, timeSlot.minute);
        logger.info('Automation checker: processed time slot', {
          configId,
          timeSlot: `${timeSlot.hour}:${timeSlot.minute.toString().padStart(2, '0')}`
        });
      }
    } catch (error) {
      logger.error('Automation checker: failed to process time slot', {
        configId,
        timeSlot: `${timeSlot.hour}:${timeSlot.minute.toString().padStart(2, '0')}`,
        error
      });
    }
  }
}

/**
 * Builds and enqueues the video generation event for a due automation.
 * Returns false when the automation was disabled instead of run (e.g. a
 * disconnected YouTube channel), so the caller skips marking the slot processed.
 */
async function sendVideoGenerationEvent(
  automation: IAutomationConfig,
  userProfile: IUserProfileWithMethods
): Promise<boolean> {
  const theme = automation.contentSettings?.theme;
  const configId = automation._id?.toString() || '';

  if (!theme) {
    logger.error('No theme found for automation', { configId });
    return false;
  }

  const youtubePlatform = automation.platforms?.youtube;
  const youtubeChannelId = youtubePlatform?.enabled ? youtubePlatform.channelId : undefined;

  if (youtubeChannelId && !userProfile.youtubeChannels?.some(ch => ch.channelId === youtubeChannelId)) {
    logger.error('YouTube channel no longer connected for automation, disabling', {
      userId: automation.userId,
      configId
    });
    await notificationRepository.create({
      userId: automation.userId,
      type: 'AUTOMATION_FAILED',
      title: `Automation ${automation.contentSettings?.theme || ''} disabled`,
      message: 'The YouTube channel connected to this automation is no longer available. Reconnect it, or turn off YouTube upload for this automation, then re-enable it.',
      links: []
    });
    await automationConfigRepository.updateById(configId, { isEnabled: false });
    return false;
  }

  const historyKey = configId || 'automation';

  if (userProfile.getTTSMinutesRemaining() <= 0) {
    logger.error('No TTS minutes remaining for user, disabling automation', { userId: automation.userId, configId });
    await notificationRepository.create({
      userId: automation.userId,
      type: 'AUTOMATION_FAILED',
      title: 'Automation failed',
      message:
        'You have no TTS minutes remaining. Please upgrade to continue using the service. Your TTS minutes reset at the beginning of your next billing period.',
      links: []
    });
    await automationConfigRepository.updateById(configId, { isEnabled: false });
    return false;
  }

  const queuedScript = await automationScriptRepository.findNextAvailable(configId);

  const tjobj: Partial<ITranscriptionJob> = {
    userId: automation.userId,
    includeMusic: automation.contentSettings?.includeMusic || false,
    brollDuration: 3.5,
    jobType: queuedScript ? 'SCRIPT' : 'PROMPT',
    status: 'VIDEO_RECEIVED'
  };
  const tj = await transcriptionJobRepository.create(tjobj);
  const tjId = tj._id!.toString();

  const orientation = automation.contentSettings?.orientation || 'vertical';
  const orientationType: 'HORIZONTAL' | 'VERTICAL' = orientation === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL';

  const exportConfig: Partial<ExportJob> = {
    userId: automation.userId,
    isWatermarked: false,
    status: 'QUEUED',
    exportType: automation.contentSettings?.captionPreset ? 'VIDEO_CAPTIONS' : 'VIDEO',
    orientationType,
    brandWatermarkUploadId: automation.contentSettings?.brandWatermarkUploadId,
    brandWatermarkPosition: automation.contentSettings?.brandWatermarkPosition,
    generateThumbnail: orientationType === 'HORIZONTAL' && automation.contentSettings?.generateThumbnail === true,
    youtubeUpload: youtubeChannelId
      ? {
          channelId: youtubeChannelId,
          isPublic: automation.contentSettings?.isPublic ?? false
        }
      : undefined
  };

  const videoGenerationEventData: VideoGenerationEventDataV3 = {
    guidance: theme,
    userId: automation.userId,
    isTalkingHead: false,
    includeMusic: automation.contentSettings?.includeMusic || false,
    tjId,
    brollDuration: 3.5,
    privateLibraryIds: automation.contentSettings?.privateLibraryIds || [],
    publicLibraryIds: automation.contentSettings?.publicLibraryIds || [],
    isVoicePremium: automation.contentSettings?.isVoicePremium || false,
    voiceType: automation.contentSettings?.voiceId || 'alloy',
    size: '1080p',
    uploadType: queuedScript ? 'script' : 'prompt',
    historyKey,
    libraries: {
      pexels: automation.contentSettings?.pexels || false
    },
    version: '3.0.0',
    language: 'en',
    isAllPublicLibrariesSelected: automation.contentSettings?.allPublicLibrariesSelected || false,
    captions: automation.contentSettings?.captionPreset,
    script: queuedScript?.script ?? theme,
    title: '',
    orientation: orientationType,
    exportConfig
  };

  await enqueueLambdaVideoGenerationTask(videoGenerationEventData);

  if (queuedScript?._id) {
    await automationScriptRepository.markAsUsed(queuedScript._id.toString());
  }

  logger.info('Automation checker: enqueued video generation', { configId, tjId });
  return true;
}
