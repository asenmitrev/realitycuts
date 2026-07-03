import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateJWT } from '../auth-middleware';
import { logger } from '../../services/logging';
import { AuthenticatedRequest } from '../../types';

// Mock dependencies
vi.mock('jsonwebtoken');
vi.mock('../../services/logging');

describe('Auth Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      headers: {}
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    mockNext = vi.fn() as unknown as NextFunction;
  });

  it('should return 401 if no authorization header', async () => {
    await authenticateJWT(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if authorization header does not start with Bearer', async () => {
    mockRequest.headers = {
      authorization: 'Basic token123'
    };

    await authenticateJWT(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should set user and call next() if token is valid', async () => {
    const mockDecodedToken = {
      id: 'user123',
      email: 'asen@1703.co',
      role: 'user'
    };

    mockRequest.headers = {
      authorization: 'Bearer validToken123'
    };

    vi.mocked(jwt.verify).mockReturnValue(mockDecodedToken);

    await authenticateJWT(mockRequest as Request, mockResponse as Response, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('validToken123', expect.any(String));
    expect(mockRequest.user).toEqual({
      uid: 'user123',
      email: 'asen@1703.co',
      id: 'user123',
      firebase_id: 'user123',
      user_id: 'user123',
    });
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return 401 and log error if token verification fails', async () => {
    const error = new Error('Invalid token');

    mockRequest.headers = {
      authorization: 'Bearer invalidToken123'
    };

    vi.mocked(jwt.verify).mockImplementation(() => {
      throw error;
    });

    await authenticateJWT(mockRequest as Request, mockResponse as Response, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('invalidToken123', expect.any(String));
    expect(logger.error).toHaveBeenCalledWith('Error verifying JWT token', {
      Error: 'Invalid token'
    });
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
