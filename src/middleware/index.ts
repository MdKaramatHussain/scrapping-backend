import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Error handling middleware
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
    });
  });

  next();
}

/**
 * API key validation middleware
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY || 'dev-key';

  if (apiKey !== expectedKey) {
    logger.warn('Invalid API key attempt', { apiKey, url: req.url });
    res.status(401).json({
      success: false,
      error: 'Invalid or missing API key',
    });
    return;
  }

  next();
}

/**
 * Async handler wrapper
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default {
  errorHandler,
  requestLogger,
  validateApiKey,
  asyncHandler,
};
