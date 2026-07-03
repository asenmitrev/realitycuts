import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import { restrictRoleAccess } from '../role-access-middleware';
import { UserProfile } from '../../models/user-profile';
import { AuthenticatedRequest } from '../../types';

// Mock dependencies
vi.mock('../../models/user-profile');

describe('Role Access Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      user: {
        user_id: 'test-user-123'
      }
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    mockNext = vi.fn() as unknown as NextFunction;
  });

  it('should return 401 if no user in request', async () => {
    mockRequest.user = undefined;

    await restrictRoleAccess(['admin'])(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Profile not found: no user in request.'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 404 if user profile not found', async () => {
    vi.mocked(UserProfile.findOne).mockResolvedValue(null);

    await restrictRoleAccess(['admin'])(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(UserProfile.findOne).toHaveBeenCalledWith({
      firebaseId: 'test-user-123'
    });
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'User profile not found.'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() if user has required role', async () => {
    vi.mocked(UserProfile.findOne).mockResolvedValue({
      role: 'admin'
    } as any);

    await restrictRoleAccess(['admin'])(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(UserProfile.findOne).toHaveBeenCalledWith({
      firebaseId: 'test-user-123'
    });
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return 404 if user does not have required role', async () => {
    vi.mocked(UserProfile.findOne).mockResolvedValue({
      role: 'user'
    } as any);

    await restrictRoleAccess(['admin'])(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(UserProfile.findOne).toHaveBeenCalledWith({
      firebaseId: 'test-user-123'
    });
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'You are unauthorized to use this route.'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow access if user has one of multiple allowed roles', async () => {
    vi.mocked(UserProfile.findOne).mockResolvedValue({
      role: 'editor'
    } as any);

    await restrictRoleAccess(['admin', 'editor'])(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      mockNext
    );

    expect(UserProfile.findOne).toHaveBeenCalledWith({
      firebaseId: 'test-user-123'
    });
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });
});
