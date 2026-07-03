import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../types';
import { logger } from '../services/logging';
import { ENVIRONMENT } from '../config/const';

const JWT_SECRET = process.env.JWT_SECRET ?? 'default-dev-secret';

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const { authorization } = req.headers;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.split('Bearer ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email?: string;
      role?: string;
    };

    (req as AuthenticatedRequest).user = {
      uid: decoded.id,
      email: decoded.email,
      id: decoded.id,
      firebase_id: decoded.id,
      user_id: decoded.id,
    } as any;

    return next();
  } catch (error: unknown) {
    const isExpired = error instanceof jwt.TokenExpiredError;
    logger.error(isExpired ? 'JWT token expired' : 'Error verifying JWT token', {
      Error: error instanceof Error ? error.message : 'Unknown error',
    });
    if (isExpired) {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

