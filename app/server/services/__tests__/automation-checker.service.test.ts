import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { checkDueAutomations } from '../automation-checker.service';
import automationConfigRepository from '../../repositories/automation-config.repository';
import userProfileRepository from '../../repositories/user-profile.repository';
import notificationRepository from '../../repositories/notification.repository';
import transcriptionJobRepository from '../../repositories/transcription-job.repository';
import automationScriptRepository from '../../repositories/automation-script.repository';
import { enqueueLambdaVideoGenerationTask } from '../task-queue';

vi.mock('../../repositories/automation-config.repository');
vi.mock('../../repositories/user-profile.repository');
vi.mock('../../repositories/notification.repository');
vi.mock('../../repositories/transcription-job.repository');
vi.mock('../../repositories/automation-script.repository');
vi.mock('../task-queue');

describe('automation-checker.service', () => {
  const baseConfig = {
    _id: 'config-1',
    userId: 'user-1',
    contentSettings: {
      theme: 'space facts',
      privateLibraryIds: ['lib-1'],
      publicLibraryIds: [],
      orientation: 'vertical'
    }
  };

  const dueTimeSlots = [{ hour: 9, minute: 0 }];

  const mockUserProfile = {
    firebaseId: 'user-1',
    getTTSMinutesRemaining: vi.fn().mockReturnValue(10)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (userProfileRepository.findByFirebaseId as Mock).mockResolvedValue(mockUserProfile);
    (automationScriptRepository.findNextAvailable as Mock).mockResolvedValue(null);
    (transcriptionJobRepository.create as Mock).mockResolvedValue({ _id: 'tj-1' });
    (automationConfigRepository.updateById as Mock).mockResolvedValue(undefined);
    (automationConfigRepository.markTimeSlotAsProcessedById as Mock).mockResolvedValue(undefined);
    (notificationRepository.create as Mock).mockResolvedValue(undefined);
    (enqueueLambdaVideoGenerationTask as Mock).mockResolvedValue(undefined);
    mockUserProfile.getTTSMinutesRemaining.mockReturnValue(10);
  });

  it('does nothing when no automations are due', async () => {
    (automationConfigRepository.findDueAutomations as Mock).mockResolvedValue([]);

    await checkDueAutomations();

    expect(enqueueLambdaVideoGenerationTask).not.toHaveBeenCalled();
  });

  it('enqueues a video generation job and marks the time slot processed', async () => {
    (automationConfigRepository.findDueAutomations as Mock).mockResolvedValue([
      { config: baseConfig, dueTimeSlots }
    ]);

    await checkDueAutomations();

    expect(enqueueLambdaVideoGenerationTask).toHaveBeenCalledTimes(1);
    expect(automationConfigRepository.markTimeSlotAsProcessedById).toHaveBeenCalledWith('config-1', 9, 0);
    expect(automationConfigRepository.updateById).not.toHaveBeenCalled();
  });

  it('disables the automation and notifies when no libraries are selected', async () => {
    const config = {
      ...baseConfig,
      contentSettings: { ...baseConfig.contentSettings, privateLibraryIds: [], publicLibraryIds: [] }
    };
    (automationConfigRepository.findDueAutomations as Mock).mockResolvedValue([{ config, dueTimeSlots }]);

    await checkDueAutomations();

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', type: 'AUTOMATION_FAILED' })
    );
    expect(automationConfigRepository.updateById).toHaveBeenCalledWith('config-1', { isEnabled: false });
    expect(enqueueLambdaVideoGenerationTask).not.toHaveBeenCalled();
  });

  it('disables the automation when the user profile is missing', async () => {
    (userProfileRepository.findByFirebaseId as Mock).mockResolvedValue(null);
    (automationConfigRepository.findDueAutomations as Mock).mockResolvedValue([{ config: baseConfig, dueTimeSlots }]);

    await checkDueAutomations();

    expect(automationConfigRepository.updateById).toHaveBeenCalledWith('config-1', { isEnabled: false });
    expect(enqueueLambdaVideoGenerationTask).not.toHaveBeenCalled();
  });

  it('disables the automation and notifies when no TTS minutes remain', async () => {
    mockUserProfile.getTTSMinutesRemaining.mockReturnValue(0);
    (automationConfigRepository.findDueAutomations as Mock).mockResolvedValue([{ config: baseConfig, dueTimeSlots }]);

    await checkDueAutomations();

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', type: 'AUTOMATION_FAILED' })
    );
    expect(automationConfigRepository.updateById).toHaveBeenCalledWith('config-1', { isEnabled: false });
    expect(enqueueLambdaVideoGenerationTask).not.toHaveBeenCalled();
  });

  it('uses a queued automation script instead of the theme when available', async () => {
    (automationScriptRepository.findNextAvailable as Mock).mockResolvedValue({
      _id: 'script-1',
      script: 'a queued script'
    });
    (automationConfigRepository.findDueAutomations as Mock).mockResolvedValue([
      { config: baseConfig, dueTimeSlots }
    ]);

    await checkDueAutomations();

    expect(enqueueLambdaVideoGenerationTask).toHaveBeenCalledWith(
      expect.objectContaining({ script: 'a queued script', uploadType: 'script' })
    );
    expect(automationScriptRepository.markAsUsed).toHaveBeenCalledWith('script-1');
  });
});
