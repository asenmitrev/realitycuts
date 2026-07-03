import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import { logger } from '../services/logging';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  let error = err;
  error.message = err.message;

  // MongoDB ObjectId casting error
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // MongoDB duplicate key error
  if (err.name === 'MongoError' && 'code' in err && err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values('errors' in err && Array.isArray(err.errors) ? err.errors : [])
      .map((val: any) => val.message)
      .join(', ');
    error = new AppError(message, 400);
  }

  // Handle operational vs programmer errors
  // Use duck typing instead of instanceof for Lambda compatibility
  // In Lambda, bundling can break instanceof checks, so we check for statusCode property
  if (error instanceof AppError || (error as any).statusCode !== undefined) {
    // Known operational error
    const statusCode = (error as any).statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message
    });
  } else {
    // Log error
    logger.error(`Error: ${req.method} ${req.path} - ${err.stack}`);

    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong'
    });
  }
};
export const unhandledRejection = () => {
  process.on('unhandledRejection', (err: Error) => {
    logger.error(`Unhandled Promise rejection: ${err.stack}`);

    // Give the server time to finish pending requests before shutting down
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};
