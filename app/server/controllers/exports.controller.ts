import { AuthenticatedRequest } from '../types';
import { Response, Request } from 'express';
import exportService from '../services/export/export.service';

export default {
  getById: async (req: Request, res: Response) => {
    const id = req.params.id;
    const exportData = await exportService.getById(id);
    res.json(exportData);
  },

  getAllForUser: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.query.id as string;
    const userId = req.user!.user_id;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 1000;

    const exportData = await exportService.getAllForUser(userId, id, limit);

    res.json(exportData);
  },

  getExportStatsByUser: async (req: Request, res: Response) => {
    const days = typeof req.query.days === 'string' ? parseInt(req.query.days) : 25;

    const stats = await exportService.getExportStatsByUser(days);
    res.json(stats);
  },

  deleteById: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    const userId = req.user!.user_id;

    const result = await exportService.deleteById(id, userId);
    res.json(result);
  },

  /**
   * Delete exports older than 30 days (UAT only)
   * Query params:
   * - days: number of days (default: 30)
   * - limit: max number of exports to delete (default: 100)
   */
  deleteOldExports: async (req: Request, res: Response) => {
    const days = typeof req.query.days === 'string' ? parseInt(req.query.days) : 30;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 100;

    const result = await exportService.deleteExportsOlderThan(days, limit);
    res.json(result);
  }
};
