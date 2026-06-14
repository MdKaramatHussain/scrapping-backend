import BaseMarketplaceParser from './BaseMarketplaceParser';
import HtmlExtractor from '../extractors/HtmlExtractor';
import { sanitizePrice } from '../../utils';
import logger from '../../config/logger';

/**
 * Myntra Product Parser
 */
export class MyntraParser extends BaseMarketplaceParser {
  name = 'MyntraParser';
  priority = 90;

  canHandle(url: string): boolean {
    return url.includes('myntra.com');
  }

  async parse(html: string, url: string): Promise<Partial<Record<string, unknown>>> {
    const extractor = this.setupExtractor(html);
    const result: Record<string, unknown> = {};

    // Layer 1: JSON-LD
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd) {
      Object.assign(result, jsonLd);
    }

    // Layer 2: Embedded JSON
    const jsonData = this.extractFromEmbeddedJson(html);
    if (jsonData) {
      Object.assign(result, jsonData);
    }

    // Layer 3: HTML extraction
    const htmlData = this.extractFromHtml(extractor);
    Object.assign(result, htmlData);

    logger.info('MyntraParser: Extraction completed', { url });
    return result;
  }

  private extractFromEmbeddedJson(html: string): Record<string, unknown> | null {
    try {
      // Myntra stores product data in window.__INITIAL_STATE__
      const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})<\/script>/);
      if (!match) {
        return null;
      }

      const jsonStr = match[1];
      const json = JSON.parse(jsonStr);

      // Navigate through Myntra's structure
      const product = json?.pdpProduct;
      if (!product) {
        return null;
      }

      logger.debug('MyntraParser: Extracted data from embedded JSON');

      return {
        name: product.productName || product.name,
        brand: product.brandName || product.brand,
        price: sanitizePrice(product.price?.discountedPrice),
        originalPrice: sanitizePrice(product.price?.mrp),
        discount: product.price?.discountPercentage,
        rating: product.ratingDistribution?.averageRating,
        reviews: product.ratingDistribution?.reviewCount,
        image: product.images?.[0],
        images: product.images,
        description: product.productDescription || product.description,
        category: product.category,
        stock: product.inStock ? 1 : 0,
      };
    } catch (error) {
      logger.debug('MyntraParser: Failed to extract from embedded JSON', { error });
      return null;
    }
  }

  private extractFromHtml(extractor: HtmlExtractor): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Title
    const title = extractor.getText('h1');
    if (title) {
      result.name = title;
    }

    // Price
    const priceText = extractor.getText('[class*="price"]');
    const price = sanitizePrice(priceText);
    if (price) {
      result.price = price;
    }

    // Rating
    const ratingText = extractor.getText('[class*="rating"]');
    const rating = parseFloat(ratingText);
    if (!isNaN(rating)) {
      result.rating = rating;
    }

    // Images
    const images = extractor.getImages('[class*="image"]');
    if (images.length > 0) {
      result.image = images[0];
      result.images = images;
    }

    // Brand
    const brand = extractor.getText('[class*="brand"]');
    if (brand) {
      result.brand = brand;
    }

    return result;
  }
}

export default MyntraParser;
