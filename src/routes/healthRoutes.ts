import { Router, Request, Response } from 'express';
import { config } from '../config';
import browserManager from '../services/browser/BrowserManager';
import logger from '../config/logger';

const router = Router();

// Metrics storage
let metrics = {
  totalRequests: 0,
  successfulScrapers: 0,
  failedScrapers: 0,
  averageExecutionTime: 0,
  startTime: new Date(),
};

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Service is healthy',
    timestamp: new Date(),
    uptime: Math.floor((Date.now() - metrics.startTime.getTime()) / 1000),
  });
});

/**
 * GET /metrics
 * Metrics endpoint
 */
router.get('/metrics', (req: Request, res: Response) => {
  if (!config.api.enable_metrics) {
    res.status(403).json({
      success: false,
      error: 'Metrics endpoint is disabled',
    });
    return;
  }

  res.status(200).json({
    success: true,
    metrics: {
      ...metrics,
      uptime: Math.floor((Date.now() - metrics.startTime.getTime()) / 1000),
    },
  });
});

/**
 * GET /status
 * Detailed status endpoint
 */
router.get('/status', (req: Request, res: Response) => {
  const uptime = Math.floor((Date.now() - metrics.startTime.getTime()) / 1000);
  const successRate =
    metrics.totalRequests > 0
      ? ((metrics.successfulScrapers / metrics.totalRequests) * 100).toFixed(2)
      : 0;

  res.status(200).json({
    success: true,
    service: 'Ecommerce Product Scraper',
    version: '1.0.0',
    status: 'operational',
    uptime,
    metrics: {
      totalRequests: metrics.totalRequests,
      successfulScrapers: metrics.successfulScrapers,
      failedScrapers: metrics.failedScrapers,
      successRate: `${successRate}%`,
      averageExecutionTime: `${metrics.averageExecutionTime.toFixed(2)}ms`,
    },
    environment: config.node_env,
    timestamp: new Date(),
  });
});

/**
 * Update metrics (called from scraper)
 */
export function updateMetrics(success: boolean, executionTime: number): void {
  metrics.totalRequests++;
  if (success) {
    metrics.successfulScrapers++;
  } else {
    metrics.failedScrapers++;
  }

  // Update average execution time
  const totalTime = metrics.averageExecutionTime * (metrics.totalRequests - 1) + executionTime;
  metrics.averageExecutionTime = totalTime / metrics.totalRequests;
}

/**
 * Reset metrics
 */
export function resetMetrics(): void {
  metrics = {
    totalRequests: 0,
    successfulScrapers: 0,
    failedScrapers: 0,
    averageExecutionTime: 0,
    startTime: new Date(),
  };
  logger.info('Metrics reset');
}

export default router;
