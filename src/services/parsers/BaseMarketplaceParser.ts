import { MarketplaceParser } from '../../interfaces';
import HtmlExtractor from '../extractors/HtmlExtractor';
import logger from '../../config/logger';

/**
 * Abstract Marketplace Parser
 * Base class for all marketplace-specific parsers
 */
export abstract class BaseMarketplaceParser implements MarketplaceParser {
  abstract name: string;
  abstract priority: number;

  abstract canHandle(url: string): boolean;

  abstract parse(html: string, url: string): Promise<Partial<Record<string, unknown>>>;

  protected extractor: HtmlExtractor | null = null;

  protected setupExtractor(html: string): HtmlExtractor {
    this.extractor = new HtmlExtractor(html);
    return this.extractor;
  }

  /**
   * Try to extract data from JSON-LD structured data
   */
  protected extractFromJsonLd(): Record<string, unknown> | null {
    if (!this.extractor) return null;

    const jsonLds = this.extractor.getJsonLd();
    const product = jsonLds.find((ld) => {
      const type = ld['@type'];
      if (typeof type === 'string') {
        return type === 'Product' || type.includes('Product');
      }
      if (Array.isArray(type)) {
        return type.some((t) => t === 'Product' || t.includes('Product'));
      }
      return false;
    });

    if (product) {
      logger.debug(`${this.name}: Extracted data from JSON-LD`);
      return product;
    }

    return null;
  }

  /**
   * Try to extract data from OG tags
   */
  protected extractFromOgTags(): Record<string, unknown> | null {
    if (!this.extractor) return null;

    const og = this.extractor.getOgTags();

    if (og.title && og.description && og.image) {
      logger.debug(`${this.name}: Extracted data from OG tags`);
      return {
        name: og.title,
        description: og.description,
        image: og.image,
      };
    }

    return null;
  }

  /**
   * Try to extract data from meta tags
   */
  protected extractFromMetaTags(): Record<string, unknown> | null {
    if (!this.extractor) return null;

    const meta = this.extractor.getAllMetaTags();
    const keywords = meta['keywords'] || '';
    const description = meta['description'] || '';

    if (description) {
      logger.debug(`${this.name}: Extracted data from meta tags`);
      return {
        description,
        specs: {
          keywords: keywords.split(',').map((k) => k.trim()),
        },
      };
    }

    return null;
  }
}

export default BaseMarketplaceParser;
