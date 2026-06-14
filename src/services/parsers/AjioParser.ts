import BaseMarketplaceParser from './BaseMarketplaceParser';
import HtmlExtractor from '../extractors/HtmlExtractor';
import { sanitizePrice } from '../../utils';
import logger from '../../config/logger';

/**
 * AJIO Product Parser
 */
export class AjioParser extends BaseMarketplaceParser {
  name = 'AjioParser';
  priority = 85;

  canHandle(url: string): boolean {
    return url.includes('ajio.com');
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

    logger.info('AjioParser: Extraction completed', { url });
    return result;
  }

  private extractFromEmbeddedJson(html: string): Record<string, unknown> | null {
    try {
      // AJIO stores data in window.__INITIAL_STATE__ or similar
      const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})<\/script>/);
      if (!match) {
        return null;
      }

      const jsonStr = match[1];
      const json = JSON.parse(jsonStr);

      // Navigate through AJIO's structure
      const product = json?.productDetail?.data || json?.product;
      if (!product) {
        return null;
      }

      logger.debug('AjioParser: Extracted data from embedded JSON');

      return {
        name: product.name || product.productName,
        brand: product.brandName || product.brand,
        price: sanitizePrice(product.price?.finalPrice || product.salePrice),
        originalPrice: sanitizePrice(product.price?.mrp || product.sellingPrice),
        discount: product.discountPercentage || product.discount,
        rating: product.rating?.average,
        reviews: product.rating?.count || product.reviewCount,
        image: product.imagePath || product.image,
        images: product.imagePath || product.images,
        description: product.description,
        category: product.category,
        stock: product.inStock ? 1 : 0,
      };
    } catch (error) {
      logger.debug('AjioParser: Failed to extract from embedded JSON', { error });
      return null;
    }
  }

  private extractFromHtml(extractor: HtmlExtractor): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Title
    const title = extractor.getText('h1, [class*="heading"]');
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
    const images = extractor.getImages();
    if (images.length > 0) {
      result.image = images[0];
      result.images = images.slice(0, 10);
    }

    // Brand
    const brand = extractor.getText('[class*="brand"]');
    if (brand) {
      result.brand = brand;
    }

    return result;
  }
}

export default AjioParser;
