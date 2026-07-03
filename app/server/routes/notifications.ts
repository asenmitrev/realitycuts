import express from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { asyncHandler } from '../utils/async-handler';
import notificationsController from '../controllers/notifications.controller';
import { connectMongo } from '../models/connect';

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

router.get('/', authenticateJWT, asyncHandler(notificationsController.getAll));
router.get('/count', authenticateJWT, asyncHandler(notificationsController.getCount));
router.post('/read-all', authenticateJWT, asyncHandler(notificationsController.markAllAsRead));

export default router;
