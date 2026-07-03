import { Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { AuthenticatedRequest } from '../types';
import { BadRequestError, NotFoundError } from '../errors';
import automationConfigRepository from '../repositories/automation-config.repository';
import automationScriptRepository from '../repositories/automation-script.repository';
import automationService from '../services/automation.service';
export class AutomationScriptController {
  listScripts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) throw new BadRequestError('User ID is required');
    const { id } = req.params;
    const config = await automationConfigRepository.findById(id);
    if (!config || config.userId !== userId) {
      throw new NotFoundError('Automation config not found');
    }
    const scripts = await automationScriptRepository.findByAutomation(id);
    res.json(scripts);
  });

  getScript = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) throw new BadRequestError('User ID is required');
    const { id, scriptId } = req.params;
    const config = await automationConfigRepository.findById(id);
    if (!config || config.userId !== userId) {
      throw new NotFoundError('Automation config not found');
    }
    const script = await automationScriptRepository.findById(scriptId);
    if (!script || script.automationConfigId.toString() !== id) {
      throw new NotFoundError('Script not found');
    }
    res.json(script);
  });

  updateScript = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) throw new BadRequestError('User ID is required');
    const { id, scriptId } = req.params;
    const { topic, script } = req.body as { topic?: string; script?: string };
    const config = await automationConfigRepository.findById(id);
    if (!config || config.userId !== userId) {
      throw new NotFoundError('Automation config not found');
    }
    const existing = await automationScriptRepository.findById(scriptId);
    if (!existing || existing.automationConfigId.toString() !== id) {
      throw new NotFoundError('Script not found');
    }
    const updated = await automationScriptRepository.updateScript(scriptId, {
      ...(topic !== undefined ? { topic } : {}),
      ...(script !== undefined ? { script } : {})
    });
    res.json(updated);
  });

  softDeleteScript = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) throw new BadRequestError('User ID is required');
    const { id, scriptId } = req.params;
    const config = await automationConfigRepository.findById(id);
    if (!config || config.userId !== userId) {
      throw new NotFoundError('Automation config not found');
    }
    const existing = await automationScriptRepository.findById(scriptId);
    if (!existing || existing.automationConfigId.toString() !== id) {
      throw new NotFoundError('Script not found');
    }
    await automationScriptRepository.softDelete(scriptId);
    res.json({ success: true });
  });

  reprocessSource = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) throw new BadRequestError('User ID is required');
    const { id, uploadId } = req.params;

    // Option A: all users have access to automation
    await automationService.reprocessAutomationSource(userId, id, uploadId);
    res.json({ success: true });
  });

  deleteScriptsBySource = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) throw new BadRequestError('User ID is required');
    const { id, uploadId } = req.params;

    const deletedCount = await automationService.deleteScriptsBySource(userId, id, uploadId);
    res.json({ success: true, deletedCount });
  });
}

export default new AutomationScriptController();
