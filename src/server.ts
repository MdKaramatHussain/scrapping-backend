import app from './app';
import { config } from './config';
import logger from './config/logger';
import browserManager from './services/browser/BrowserManager';

const PORT = config.port;
console.log("Node Version:", process.version);

// rest of your code
/**
 * Start Server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize browser manager
    await browserManager.initialize();
    browserManager.startCleanupTask();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log("Node Version:", process.version);
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${config.node_env}`);
      logger.info(`Browser pool size: ${config.browser.pool_size}`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`, { error });
      } else {
        logger.error('Server error', { error });
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
