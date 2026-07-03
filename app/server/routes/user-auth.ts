import express from 'express';
import { connectMongo } from '../models/connect';
import { configureDotenv } from '../config/dotenv';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import { authenticateJWT } from '../middleware/auth-middleware';
import userAuthController from '../controllers/user-auth.controller';
import { z } from 'zod';

configureDotenv();

const router = express.Router();

// Ensure MongoDB connection
router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

// Validation schemas
const registerBodySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

const loginBodySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Public routes
router.post(
  '/register',
  validateRequest({ body: registerBodySchema }),
  asyncHandler(userAuthController.register)
);

router.post(
  '/login',
  validateRequest({ body: loginBodySchema }),
  asyncHandler(userAuthController.login)
);

// Token refresh (no auth required — uses httpOnly cookie, body refreshToken is optional for backward compat)
const refreshBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

router.post('/refresh',
  validateRequest({ body: refreshBodySchema }),
  asyncHandler(userAuthController.refresh)
);

// Logout (no-op server-side, client discards tokens)
router.post('/logout', asyncHandler(userAuthController.logout));

// Protected routes
router.get('/me', authenticateJWT, asyncHandler(userAuthController.me));

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

router.post('/change-password',
  authenticateJWT,
  validateRequest({ body: changePasswordBodySchema }),
  asyncHandler(userAuthController.changePassword)
);

export default router;
