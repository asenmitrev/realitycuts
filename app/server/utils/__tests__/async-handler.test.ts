import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../async-handler';

describe('asyncHandler', () => {
  it('should call the async function with req, res, and next', async () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);
    const handler = asyncHandler(mockFn);

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    await handler(req, res, next);

    expect(mockFn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return the result when the async function succeeds', async () => {
    const expectedResult = { data: 'success' };
    const mockFn = vi.fn().mockResolvedValue(expectedResult);
    const handler = asyncHandler(mockFn);

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    const result = await handler(req, res, next);

    expect(result).toBe(expectedResult);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with error when the async function throws', async () => {
    const testError = new Error('Test error');
    const mockFn = vi.fn().mockRejectedValue(testError);
    const handler = asyncHandler(mockFn);

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(testError);
  });

  it('should handle promise rejection and pass error to next', async () => {
    const testError = new Error('Promise rejected');
    const mockFn = vi.fn().mockReturnValue(Promise.reject(testError));
    const handler = asyncHandler(mockFn);

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(testError);
  });
});
