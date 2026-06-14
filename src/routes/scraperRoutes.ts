import { Router } from 'express';
import ScraperController from '../controllers/ScraperController';
import { asyncHandler } from '../middleware';

const router = Router();

/**
 * POST /api/scrape
 * Scrape a product page and extract normalized data
 *
 * Request body:
 * {
 *   "url": "https://www.flipkart.com/product-url",
 *   "marketplace": "flipkart" (optional),
 *   "options": {
 *     "headless": true,
 *     "timeout": 30000
 *   }
 * }
 */
router.post('/scrape', asyncHandler(ScraperController.scrapeProduct));

export default router;
