import axios from 'axios';
import { Page } from 'playwright';
import { Product, ProductImportResult, ScrapeRequest } from '../../types/product';
import { parserRegistry } from '../parsers/ParserRegistry';
import { ProductValidator } from '../validators/ProductValidator';
import { HtmlExtractor } from '../extractors/HtmlExtractor';
import browserManager from '../browser/BrowserManager';
import { retryWithBackoff, randomDelay, extractDomain, isValidUrl, sanitizePrice } from '../../utils';
import logger from '../../config/logger';
import { config } from '../../config';
import { v4 as uuidv4 } from 'uuid';

/**
 * Main Scraper Service
 * Orchestrates multi-layer extraction strategy
 */
export class ScraperService {
  /**
   * Scrape a product page and extract normalized data
   */
  static async scrapeProduct(request: ScrapeRequest): Promise<ProductImportResult> {
    const startTime = Date.now();
    const { url } = request;

    try {
      // Validate URL
      if (!isValidUrl(url)) {
        logger.error('Invalid URL provided', { url });
        return {
          success: false,
          error: 'Invalid URL format',
          metadata: {
            source: 'unknown',
            confidence: 0,
            originalUrl: url,
            timestamp: new Date(),
          },
        };
      }

      const domain = extractDomain(url);
      logger.info('Starting product scrape', { url, domain });

      // Layer 1: Try marketplace-specific parser
      let htmlContent: string | null = null;
      let rawData: Partial<Record<string, unknown>> = {};

      // Get HTML content
      htmlContent = await this.fetchHtml(url);
      if (!htmlContent) {
        return {
          success: false,
          error: 'Failed to fetch page content',
          metadata: {
            source: domain || 'unknown',
            confidence: 0,
            originalUrl: url,
            timestamp: new Date(),
            extractionMethod: 'html-parser',
          },
        };
      }

      // Layer 1: Try embedded JSON extraction
      rawData = await this.tryEmbeddedJson(htmlContent);
      // rawData = {}; // --- IGNORE ---
      if (Object.keys(rawData).length > 0) {
        const validated = this.validateAndNormalize(rawData);
        const executionTime = Date.now() - startTime;

        return {
          success: validated.valid,
          product: validated.data,
          warnings: validated.warnings,
          error: validated.valid ? undefined : 'Extracted data failed validation',
          metadata: {
            source: domain || 'unknown',
            confidence: validated.confidence,
            originalUrl: url,
            timestamp: new Date(),
            extractionMethod: 'embedded-json',
            executionTime,
          },
        };
      }

      // Layer 2: Try structured data extraction
      rawData = this.tryStructuredData(htmlContent);
      if (Object.keys(rawData).length > 0) {
        const validated = this.validateAndNormalize(rawData);
        const executionTime = Date.now() - startTime;

        return {
          success: validated.valid,
          product: validated.data,
          warnings: validated.warnings,
          error: validated.valid ? undefined : 'Extracted data failed validation',
          metadata: {
            source: domain || 'unknown',
            confidence: validated.confidence,
            originalUrl: url,
            timestamp: new Date(),
            extractionMethod: 'structured-data',
            executionTime,
          },
        };
      }

      // Layer 3: Try marketplace-specific parser
      rawData = await this.tryMarketplaceParser(htmlContent, url);
      if (Object.keys(rawData).length > 0) {
        const validated = this.validateAndNormalize(rawData);
        const executionTime = Date.now() - startTime;

        return {
          success: validated.valid,
          product: validated.data,
          warnings: validated.warnings,
          error: validated.valid ? undefined : rawData,
          // error: validated.valid ? undefined : 'Extracted data failed validation',
          metadata: {
            source: domain || 'unknown',
            confidence: validated.confidence,
            originalUrl: url,
            timestamp: new Date(),
            extractionMethod: 'marketplace-parser',
            executionTime,
          },
        };
      }
      // Layer 4:- Trying to fetch data from INITIAL STATE or PRELOADED_STATE which is commonly used by modern web apps to store product data. This is often the richest source of data and can bypass the need for complex HTML parsing.
      rawData = await this.tryInitialStateExtraction(htmlContent);
      if (Object.keys(rawData).length > 0) {
        const validated = this.validateAndNormalize(rawData);
        const executionTime = Date.now() - startTime;

        return {
          success: validated.valid,
          product: validated.data,
          warnings: validated.warnings,
          error: validated.valid ? undefined : 'Extracted data failed validation',
          metadata: {
            source: domain || 'unknown',
            confidence: validated.confidence,
            originalUrl: url,
            timestamp: new Date(),
            extractionMethod: 'initial-state',
            executionTime,
          },
        };
      }

      // Layer 5: Try basic HTML parsing
      rawData = this.tryHtmlParsing(htmlContent);
      if (Object.keys(rawData).length > 0) {
        const validated = this.validateAndNormalize(rawData);
        const executionTime = Date.now() - startTime;

        return {
          success: validated.valid,
          product: validated.data,
          warnings: validated.warnings,
          error: validated.valid ? undefined : 'Extracted data failed validation',
          metadata: {
            source: domain || 'unknown',
            confidence: validated.confidence,
            originalUrl: url,
            timestamp: new Date(),
            extractionMethod: 'html-parser',
            executionTime,
          },
        };
      }

      // All extraction methods failed
      logger.warn('All extraction methods failed for URL', { url });
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: 'Could not extract product data from page',
        metadata: {
          source: domain || 'unknown',
          confidence: 0,
          originalUrl: url,
          timestamp: new Date(),
          extractionMethod: 'html-parser',
          executionTime,
        },
      };
    } catch (error) {
      logger.error('Error during product scraping', { error, url });
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          source: extractDomain(url) || 'unknown',
          confidence: 0,
          originalUrl: url,
          timestamp: new Date(),
          executionTime,
        },
      };
    }
  }

  /**
   * Fetch HTML content from URL
   */
  private static async fetchHtml(url: string): Promise<string | null> {
    try {
      // First, try with Axios (faster for simple pages)
      try {
        const response = await retryWithBackoff(
          () =>
            axios.get(url, {
              timeout: config.browser.page_load_timeout,
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            }),
          2,
          1000
        );

        logger.debug('Successfully fetched HTML with Axios', { url });
        return response.data;
      } catch (axiosError) {
        logger.debug('Axios fetch failed, trying Playwright', { axiosError });

        // Fall back to Playwright for JavaScript-heavy sites
        return await this.fetchHtmlWithPlaywright(url);
      }
    } catch (error) {
      logger.error('Failed to fetch HTML content', { error, url });
      return null;
    }
  }

  /**
   * Fetch HTML using Playwright
   */
  private static async fetchHtmlWithPlaywright(url: string): Promise<string | null> {
    let page: Page | null = null;

    try {
      const context = await browserManager.getContext();
      page = await context.newPage();

      // Add random delay to avoid detection
      await randomDelay();

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.browser.page_load_timeout,
      });

      // Wait for potential dynamic content
      await page.waitForTimeout(1000);

      const html = await page.content();
      logger.debug('Successfully fetched HTML with Playwright', { url });
      return html;
    } catch (error) {
      logger.error('Playwright fetch failed', { error, url });
      return null;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Try INITIAL_STATE or PRELOADED_STATE JSON extraction for modern web apps
   * This is often the richest source of product data and can bypass complex HTML parsing
   * We check for common global variables where apps store their initial state
   * If found, we parse it and look for product-related data structures
   * This can be a game-changer for sites that heavily rely on client-side rendering
   * and have minimal server-rendered HTML content. It allows us to access the raw data
   * before it gets transformed into HTML, which can be more reliable and complete.
   * We also add logging to see if these variables are present in the HTML, which can help us understand
   * how many sites we can extract data from using this method and improve our parsers accordingly.
   */
  private static async tryInitialStateExtraction(
    html: string
  ): Promise<Partial<Product>> {
    try {
      const match = html.match(
        /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/
      );

      if (!match?.[1]) {
        return {};
      }

      const state = JSON.parse(match[1]);

      const findValue = (obj: unknown, key: string): unknown => {
        if (!obj || typeof obj !== 'object') {
          return null;
        }

        const record = obj as Record<string, unknown>;

        if (record[key] !== undefined) {
          return record[key];
        }

        for (const value of Object.values(record)) {
          const found = findValue(value, key);

          if (found !== null) {
            return found;
          }
        }

        return null;
      };
      const extractor = new HtmlExtractor(html);
      const images = extractor.getImages().filter((img) => typeof img === 'string' && img.startsWith('https://rukminim2.flixcart.com/image'));

      const sellingPrice = Number(findValue(state, 'sellingPrice') ?? findValue(state, 'price') ?? 0);

      const mrp = Number(findValue(state, 'mrp') ?? findValue(state, 'maxRetailPrice') ?? sellingPrice);

      const product: Partial<Product> = {
        id: String(findValue(state, 'productId') ?? findValue(state, 'pid') ?? ''),

        name: String(findValue(state, 'prependingText') ?? findValue(state, 'productName') ?? ''),

        description: String(findValue(state, 'description') ?? ''),

        category: String(findValue(state, 'title') ?? findValue(state, 'productName') ?? ''),

        categoryId: String(findValue(state, 'categoryId') ?? ''),

        subcategory: String(findValue(state, 'subCategory') ?? findValue(state, 'subcategory') ?? ''),

        brand: String(findValue(state, 'prependingText') ?? findValue(state, 'productName') ?? '').split(' ')[0],

        price: sellingPrice,

        originalPrice: mrp,

        discount: mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0,

        rating: Number(findValue(state, 'averageRating') ?? findValue(state, 'rating') ?? 0),

        reviews: Number(findValue(state, 'reviewCount') ?? 0),

        stock: Number(findValue(state, 'stock') ?? findValue(state, 'availableQuantity') ?? 0),

        images: Array.isArray(images) ? images.map(String).slice(0, 5) : [],

        image: Array.isArray(images) && images.length > 0 ? String(images[0]) : '',

        thumbnail: Array.isArray(images) && images.length > 0 ? String(images[0]) : '',

        warranty: String(findValue(state, 'warranty') ?? ''),

        delivery: String(findValue(state, 'deliveryText') ?? findValue(state, 'deliveryMessage') ?? ''),

        specs: (findValue(state, 'specifications') as Record<string, unknown>) ?? {},

        seller: {
          id: String(findValue(state, 'sellerId') ?? ''),

          name: String(findValue(state, 'sellerName') ?? ''),

          verified: Boolean(findValue(state, 'sellerVerified') ?? false),

          rating: Number(findValue(state, 'sellerRating') ?? 0),
        },

        seoTitle: String(findValue(state, 'seoTitle') ?? ''),

        seoDescription: String(findValue(state, 'seoDescription') ?? ''),

        sku: String(findValue(state, 'sku') ?? ''),

        createdAt: new Date(),
      };

      return product;
    } catch (error) {
      logger.debug('INITIAL_STATE extraction failed', {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      return {};
    }
  }

  /**
   * Try marketplace-specific parser
   */
  private static async tryMarketplaceParser(
    html: string,
    url: string
  ): Promise<Partial<Record<string, unknown>>> {
    try {
      const parser = parserRegistry.getParser(url);
      if (!parser) {
        return {};
      }

      const data = await parser.parse(html, url);
      logger.debug(`Parser ${parser.name} returned data`, { keys: Object.keys(data) });
      return data;
    } catch (error) {
      logger.debug('Marketplace parser failed', { error, url });
      return {};
    }
  }

  /**
   * Try structured data (JSON-LD, OG tags)
   */
  private static tryStructuredData(html: string): Partial<Record<string, unknown>> {
    try {
      const extractor = new HtmlExtractor(html);

      // Try JSON-LD first
      const jsonLds = extractor.getJsonLd();
      const productJsonLd = jsonLds.find((ld) => {
        const type = Array.isArray(ld) && ld.length > 0 ? ld[0]['@type'] : ld['@type'];
        if (Array.isArray(type)) {
          return type.includes('Product');
        }
        return typeof type === 'string' && type === 'Product';
      });
      if (productJsonLd) {
        const price = Array.isArray(productJsonLd) && productJsonLd.length > 0 ? productJsonLd[0]['offers']?.['price'] || 0 : 0;
        const name = Array.isArray(productJsonLd) && productJsonLd.length > 0 ? productJsonLd[0]['name'] || '' : '';
        logger.debug('Extracted data from JSON-LD');
        if (Array.isArray(productJsonLd) && productJsonLd.length > 0) {
          return {
            name: productJsonLd[0]['name'] || '',
            price: sanitizePrice(productJsonLd[0]['offers']?.['price'] || 0),
            description: productJsonLd[0]['description'] || '',
            brand: productJsonLd[0]['brand']?.['name'] || productJsonLd[0]['brand'] || '',
            category: productJsonLd[0]['category'] || '',
            rating: productJsonLd[0]['aggregateRating']?.['ratingValue'] || 0,
            reviews: productJsonLd[0]['aggregateRating']?.['reviewCount'] || 0,
            image: Array.isArray(productJsonLd[0]['image']) ? productJsonLd[0]['image'][0] : productJsonLd[0]['image'],
            images: Array.isArray(productJsonLd[0]['image']) ? productJsonLd[0]['image'] : [productJsonLd[0]['image']],
          }
        }
        return productJsonLd;
      }

      // Try OG tags
      const ogData = extractor.getOgTags();
      if (ogData.title && (ogData.image || ogData.description)) {
        logger.debug('Extracted data from OG tags');
        return {
          name: ogData['name'] || '',
          price: sanitizePrice(ogData['price'] || 0),
          description: ogData['description'] || '',
          brand: ogData['brand'] || '',
          category: ogData['category'] || '',
          rating: ogData['rating'] || 0,
          reviews: ogData['reviews'] || 0,
          image: Array.isArray(ogData['image']) ? ogData['image'][0] : ogData['image'],
          images: Array.isArray(ogData['image']) ? ogData['image'] : [ogData['image']],
        };
      }

      return {};
    } catch (error) {
      logger.debug('Structured data extraction failed', { error });
      return {};
    }
  }

  /**
   * Try embedded JSON extraction
   */
  private static async tryEmbeddedJson(html: string): Promise<Partial<Record<string, unknown>>> {
    try {
      const matches = html.match(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      );

      if (!matches) {
        return {};
      }

      for (const script of matches) {
        try {
          const jsonMatch = script.match(
            /<script[^>]*>([\s\S]*?)<\/script>/
          );

          if (!jsonMatch?.[1]) {
            continue;
          }

          const data = JSON.parse(jsonMatch[1]);

          const product = Array.isArray(data)
            ? data[0]
            : data;

          if (!product?.name) {
            continue;
          }

          return {
            name: product.name,
            price: product.offers.price > 0 ? product.offers.price : 0,
            description: product.description,
            brand:
              product.brand?.name ||
              product.brand,
            category: product.category,
            rating:
              product.aggregateRating?.ratingValue,
            reviews:
              product.aggregateRating?.reviewCount,
            images: product.image || [],
            image:
              product.image?.[0] || '',
            sku: product.sku,
            color: product.color,
          };
        } catch {
          continue;
        }
      }

      return {};
    } catch {
      return {};
    }
  }

  // private static tryEmbeddedJson(html: string): Partial<Record<string, unknown>> {
  //   try {
  //     // Look for common embedded JSON patterns
  //     const patterns = [
  //       /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/,
  //       /window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});/,
  //       /window\.PRELOADED_STATE\s*=\s*(\{[\s\S]*?\});/,
  //     ];

  //     for (const pattern of patterns) {
  //       const match = html.match(pattern);
  //       if (match) {
  //         try {
  //           const json = JSON.parse(match[1]);
  //           if (Object.keys(json).length > 0) {
  //             logger.debug('Extracted data from embedded JSON');
  //             return json;
  //           }
  //         } catch {
  //           // Invalid JSON, continue
  //         }
  //       }
  //     }

  //     return {};
  //   } catch (error) {
  //     logger.debug('Embedded JSON extraction failed', { error });
  //     return {};
  //   }
  // }



  /**
   * Try basic HTML parsing
   */
  private static tryHtmlParsing(html: string): Partial<Record<string, unknown>> {
    try {
      const extractor = new HtmlExtractor(html);

      const result: Partial<Record<string, unknown>> = {};

      // Extract basic info
      const title = extractor.getText('h1, h2, title, [class*="title"], [class*="name"]');
      if (title) {
        result.name = title;
      }

      const description = extractor.getText('[class*="description"], [class*="detail"], p');
      if (description) {
        result.description = description;
      }

      const images = extractor.getImages();
      if (images.length > 0) {
        result.image = images[0];
        result.images = images.slice(0, 5);
      }

      const meta = extractor.getAllMetaTags();
      if (meta.keywords) {
        result.specs = { keywords: meta.keywords.split(',') };
      }

      if (Object.keys(result).length > 0) {
        logger.debug('Extracted data from HTML parsing');
        return result;
      }

      return {};
    } catch (error) {
      logger.debug('HTML parsing failed', { error });
      return {};
    }
  }

  /**
   * Validate and normalize extracted data
   */
  private static validateAndNormalize(
    rawData: Partial<Record<string, unknown>>
  ): { valid: boolean; data: Partial<Product>; errors: string[]; warnings: string[]; confidence: number } {
    const validation = ProductValidator.validate(rawData);

    // Add product ID if missing
    if (!validation.data.id) {
      validation.data.id = uuidv4();
    }

    return validation;
  }
}

export default ScraperService;
