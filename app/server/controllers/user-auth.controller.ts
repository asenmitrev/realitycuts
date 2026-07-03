import { Response, Request } from 'express';
import userAuthService from '../services/user-auth.service';
import { verifyRefreshToken, createAccessToken, createRefreshToken } from '../services/auth';
import { AuthenticatedRequest } from '../types';
import { logger } from '../services/logging';

const REFRESH_COOKIE_NAME = 'refresh_token';

export default {
  register: async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const { user, token } = await userAuthService.register(email, password, firstName, lastName);
    const refreshToken = createRefreshToken(user.id);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh',
    });
    res.status(201).json({ user, accessToken: token });
  },

  login: async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const { user, token } = await userAuthService.login(email, password);
    const refreshToken = createRefreshToken(user.id);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh',
    });
    res.json({ user, accessToken: token });
  },

  me: async (req: AuthenticatedRequest, res: Response) => {
    const userId = (req.user as any)?.uid ?? req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await userAuthService.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  },

  refresh: async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token found.' });
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const accessToken = await userAuthService.refreshToken(decoded.id);
      // Rotate refresh token — issue a new one
      const newRefreshToken = createRefreshToken(decoded.id);
      res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth/refresh',
      });
      res.json({ accessToken });
    } catch {
      // Invalid/expired refresh token — clear cookie and force logout
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth/refresh' });
      return res.status(401).json({ error: 'Invalid or expired refresh token.', code: 'REFRESH_TOKEN_INVALID' });
    }
  },

  logout: async (req: AuthenticatedRequest, res: Response) => {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth/refresh' });
    res.json({ message: 'Logged out successfully.' });
  },

  changePassword: async (req: AuthenticatedRequest, res: Response) => {
    const userId = (req.user as any)?.uid ?? req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    await userAuthService.changePassword(userId, currentPassword, newPassword);
    res.json({ message: 'Password updated successfully.' });
  }
};
