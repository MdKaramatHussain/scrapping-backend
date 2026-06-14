import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import logger from './config/logger';
import scraperRoutes from './routes/scraperRoutes';
import healthRoutes from './routes/healthRoutes';
import { updateMetrics } from './routes/healthRoutes';
import { errorHandler, requestLogger, validateApiKey, asyncHandler } from './middleware';
import browserManager from './services/browser/BrowserManager';

const app: Express = express();

/**
 * Middleware Setup
 */

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rate_limit.window_ms,
  max: config.rate_limit.max_requests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

/**
 * Routes
 */

// Health check endpoints (no API key required)
app.use('/', healthRoutes);

// API routes (require API key)
app.use('/api', validateApiKey);
app.use('/api', scraperRoutes);

/**
 * Middleware for wrapping scraper responses with metrics
 */
app.use(
  '/api/scrape',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (data: unknown) {
      if (typeof data === 'object' && data !== null && 'metadata' in data) {
        const result = data as { success: boolean; metadata?: { executionTime?: number } };
        const executionTime = result.metadata?.executionTime || 0;
        updateMetrics(result.success, executionTime);
      }
      return originalJson(data);
    };

    next();
  })
);

/**
 * 404 Handler
 */
app.use((req: Request, res: Response) => {
  logger.warn('404 Not Found', { method: req.method, url: req.url });
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

/**
 * Error Handler
 */
app.use(errorHandler);

/**
 * Graceful Shutdown
 */
async function shutdown(): Promise<void> {
  logger.info('Shutting down application...');
  try {
    await browserManager.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
