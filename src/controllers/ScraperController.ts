import { Request, Response } from 'express';
import { ScraperService } from '../services/scraper/ScraperService';
import { ScrapeRequest } from '../types/product';
import logger from '../config/logger';

/**
 * Scraper Controller
 */
export class ScraperController {
  /**
   * POST /api/scrape
   * Scrape a product from the given URL
   */
  static async scrapeProduct(req: Request, res: Response): Promise<void> {
    try {
      const { url, marketplace, options } = req.body as ScrapeRequest;

      // Validate required fields
      if (!url) {
        res.status(400).json({
          success: false,
          error: 'URL is required',
        });
        return;
      }

      if (typeof url !== 'string') {
        res.status(400).json({
          success: false,
          error: 'URL must be a string',
        });
        return;
      }

      logger.info('Scrape request received', { url });

      // Call scraper service
      const result = await ScraperService.scrapeProduct({
        url,
        marketplace,
        options,
      });

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in scrapeProduct controller', { error });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

export default ScraperController;
