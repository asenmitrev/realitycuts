import { Request, Response, NextFunction } from 'express';

// Type for controller function that handles async operations
type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

// Higher-order function to wrap async controller methods
export const asyncHandler =
  (fn: AsyncFunction) =>
  (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
