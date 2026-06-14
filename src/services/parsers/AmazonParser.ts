import BaseMarketplaceParser from './BaseMarketplaceParser';
import HtmlExtractor from '../extractors/HtmlExtractor';
import { sanitizePrice } from '../../utils';
import logger from '../../config/logger';

/**
 * Amazon India Product Parser
 */
export class AmazonParser extends BaseMarketplaceParser {
  name = 'AmazonParser';
  priority = 95;

  canHandle(url: string): boolean {
    return url.includes('amazon.in') || url.includes('amazon.com');
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

    logger.info('AmazonParser: Extraction completed', { url });
    return result;
  }

  private extractFromEmbeddedJson(html: string): Record<string, unknown> | null {
    try {
      // Amazon stores initial data in window.P.when('A')
      const match = html.match(/var\s+a_state\s*=\s*(\{[\s\S]*?\});/);
      if (!match) {
        return null;
      }

      const jsonStr = match[1];
      const json = JSON.parse(jsonStr);

      logger.debug('AmazonParser: Extracted data from embedded JSON');

      return {
        name: json.dpTitle?.text,
        description: json.featurebullets?.map((fb: Record<string, unknown>) => fb.text)?.join('\n'),
        price: sanitizePrice(json.pricing?.currentPrice?.value),
        rating: parseFloat(json.rating?.text),
        reviews: parseInt(json.reviewCount?.text?.replace(/[^\d]/g, '') || '0'),
        image: json.images?.[0]?.src,
        images: json.images?.map((img: Record<string, unknown>) => img.src),
      };
    } catch (error) {
      logger.debug('AmazonParser: Failed to extract from embedded JSON', { error });
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
    const priceText = extractor.getText('[class*="a-price"]');
    const price = sanitizePrice(priceText);
    if (price) {
      result.price = price;
    }

    // Rating
    const ratingText = extractor.getText('[class*="a-star"]');
    const rating = parseFloat(ratingText);
    if (!isNaN(rating)) {
      result.rating = rating;
    }

    // Reviews
    const reviewsText = extractor.getText('[class*="a-link-normal"] [class*="a-size"]');
    const reviews = parseInt(reviewsText.replace(/[^\d]/g, ''));
    if (!isNaN(reviews)) {
      result.reviews = reviews;
    }

    // Images
    const images = extractor.getImages('[id*="landingImage"]');
    if (images.length > 0) {
      result.image = images[0];
      result.images = images;
    }

    // Description (feature bullets)
    const features: string[] = [];
    extractor.getAllText('[class*="feature"]').forEach((feature) => {
      if (feature) {
        features.push(feature);
      }
    });
    if (features.length > 0) {
      result.description = features.join('\n');
    }

    // Brand
    const bylineText = extractor.getText('[class*="bylineInfo"]');
    if (bylineText) {
      const brand = bylineText.replace(/Visit the.*store/i, '').trim();
      if (brand) {
        result.brand = brand;
      }
    }

    return result;
  }
}

export default AmazonParser;
