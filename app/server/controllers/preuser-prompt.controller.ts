import { Request, Response } from 'express';
import * as service from '../services/preuser-prompt.service';
import { CLIENT_URL } from '../config/const';
import { AuthenticatedRequest } from '../types';

export const create = async (req: Request, res: Response) => {
  const { prompt } = req.body;
  const libraryIds = req.query.libraryIds as string | undefined; // comma-separated library IDs

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  const { token } = await service.createPrompt(prompt, libraryIds);
  res.json({ token });
};

export const get = async (req: Request, res: Response) => {
  const { token } = req.params;
  const record = await service.getPrompt(token);
  if (!record) return res.status(404).json({ error: 'Not found' });
  res.json({ prompt: record.prompt, libraryIds: record.libraryIds, libraryName: record.libraryName });
};

export const submitAndRedirect = async (req: Request, res: Response) => {
  const { prompt } = req.body;
  const libraryIds = req.query.libraryIds as string | undefined; // comma-separated library IDs

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const { token } = await service.createPrompt(prompt, libraryIds);

  // Redirect to frontend page with token
  const redirectUrl = `${CLIENT_URL}/preuser-prompt?prompt_token=${token}`;
  res.status(303).location(redirectUrl).json({ redirect: redirectUrl });
};

export const getAllForAdmin = async (req: AuthenticatedRequest, res: Response) => {
  const skip = typeof req.query.skip === 'string' ? parseInt(req.query.skip) : 0;
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 50;

  const result = await service.getAllPreuserPromptsForAdmin(skip, limit);

  res.json({
    prompts: result.prompts,
    total: result.total
  });
};

export const getStats = async (req: AuthenticatedRequest, res: Response) => {
  const days = typeof req.query.days === 'string' ? parseInt(req.query.days) : 28;

  const stats = await service.getPreuserPromptStats(days);
  res.json(stats);
};
