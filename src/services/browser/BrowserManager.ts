import { chromium, Browser, BrowserContext } from 'playwright';
import { config } from '../../config';
import logger from '../../config/logger';

interface ContextWithBrowser {
  context: BrowserContext;
  browser: Browser;
  lastUsed: number;
}

/**
 * Browser Manager - Singleton pattern
 * Manages a pool of browser instances for scraping
 */
export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private contexts: ContextWithBrowser[] = [];
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  /**
   * Initialize the browser pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing browser...');

      this.browser = await chromium.launch({
        headless: config.browser.headless,
      });

      this.isInitialized = true;
      logger.info('Browser initialized successfully');
    } catch (error) {
      console.log(error)
      logger.error('Failed to initialize browser', { error });
      throw error;
    }
  }

  /**
   * Get an available browser context
   */
  async getContext(): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initialize();
    }

    // Check for idle contexts
    const now = Date.now();
    const idleContext = this.contexts.find((ctx) => {
      if (now - ctx.lastUsed <= 60000) return false;
      const browser = ctx.context.browser?.();
      // browser may be null; isConnected is a method
      return !browser || !browser.isConnected?.();
    });

    if (idleContext) {
      idleContext.lastUsed = now;
      return idleContext.context;
    }

    // Create new context if under pool size
    if (this.contexts.length < config.browser.pool_size) {
      const context = await this.browser!.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const contextWithBrowser: ContextWithBrowser = {
        context,
        browser: this.browser!,
        lastUsed: now,
      };

      this.contexts.push(contextWithBrowser);
      logger.debug(`Created new browser context. Pool size: ${this.contexts.length}`);
      return context;
    }

    // Return least recently used context
    const lru = this.contexts.reduce((prev, current) =>
      prev.lastUsed < current.lastUsed ? prev : current
    );
    lru.lastUsed = now;
    return lru.context;
  }

  /**
   * Clean up old contexts
   */
  private async cleanupOldContexts(): Promise<void> {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (let i = this.contexts.length - 1; i >= 0; i--) {
      const ctx = this.contexts[i];
      if (now - ctx.lastUsed > maxAge) {
        try {
          await ctx.context.close();
          this.contexts.splice(i, 1);
          logger.debug('Closed old browser context');
        } catch (error) {
          logger.error('Error closing context', { error });
        }
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down browser manager...');

      for (const ctx of this.contexts) {
        try {
          await ctx.context.close();
        } catch (error) {
          logger.error('Error closing context during shutdown', { error });
        }
      }

      if (this.browser) {
        await this.browser.close();
      }

      this.contexts = [];
      this.browser = null;
      this.isInitialized = false;
      logger.info('Browser manager shut down successfully');
    } catch (error) {
      logger.error('Error during browser shutdown', { error });
    }
  }

  /**
   * Periodic cleanup task
   */
  startCleanupTask(): void {
    setInterval(() => {
      this.cleanupOldContexts();
    }, 60000); // Run every minute
  }
}

export default BrowserManager.getInstance();
