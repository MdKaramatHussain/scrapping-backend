import BaseMarketplaceParser from './BaseMarketplaceParser';
import HtmlExtractor from '../extractors/HtmlExtractor';
import { sanitizePrice } from '../../utils';
import logger from '../../config/logger';

/**
 * Flipkart Product Parser
 * Extracts product information from Flipkart product pages
 */
export class FlipkartParser extends BaseMarketplaceParser {
  name = 'FlipkartParser';
  priority = 100; // High priority

  canHandle(url: string): boolean {
    return url.includes('flipkart.com');
  }

  async parse(html: string, url: string): Promise<Partial<Record<string, unknown>>> {
    const extractor = this.setupExtractor(html);
    const result: Record<string, unknown> = {};

    // Layer 1: Try JSON-LD
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd && Object.keys(jsonLd).length > 2) {  // Ensure we got meaningful data
      Object.assign(result, jsonLd);
    }

    // Layer 2: Try OG tags
    if (Object.keys(result).length === 0) {
      const ogData = this.extractFromOgTags();
      if (ogData && Object.keys(ogData).length > 0) {
        Object.assign(result, ogData);
      }
    }

    // Layer 3: Try to extract from embedded JSON
    const jsonData = this.extractFromEmbeddedJson(html);
    if (jsonData && Object.keys(jsonData).length > 0) {
      Object.assign(result, jsonData);
    }

    // Layer 4: HTML-based extraction (this should always run to fill gaps)
    const htmlData = this.extractFromHtml(extractor);
    // Merge HTML data, preferring existing data for populated fields
    for (const [key, value] of Object.entries(htmlData)) {
      if (value && !result[key]) {
        result[key] = value;
      }
    }

    logger.info('FlipkartParser: Extraction completed', { url, fieldsExtracted: Object.keys(result).length });
    return result;
  }

  private extractFromEmbeddedJson(html: string): Record<string, unknown> | null {
    try {
      // Try multiple patterns where Flipkart stores product data
      const patterns = [
        /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/,
        /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/,
        /window\.pageContext\s*=\s*(\{[\s\S]*?\});/,
      ];

      let json: any = null;
      let jsonStr = '';

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          try {
            jsonStr = match[1];
            json = JSON.parse(jsonStr);
            if (json && Object.keys(json).length > 0) {
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      if (!json) {
        return null;
      }

      // Navigate to product data with multiple fallback paths
      let productData = json?.productPage?.data?.productData ||
        json?.productPage?.productData ||
        json?.data?.productData ||
        json?.product?.data ||
        json?.pdpData?.product ||
        json?.pdp?.productData;

      if (!productData) {
        return null;
      }

      logger.debug('FlipkartParser: Extracted data from embedded JSON');

      return {
        id: productData.productId || productData.id,
        name: productData.title || productData.productTitle || productData.name,
        description: productData.productDescription || productData.description,
        brand: productData.brand,
        price: sanitizePrice(productData.priceDetails?.finalPrice || productData.price),
        originalPrice: sanitizePrice(productData.priceDetails?.mrp || productData.originalPrice),
        discount: productData.priceDetails?.discount || productData.discount,
        rating: productData.rating || productData.avgRating,
        reviews: productData.reviewCount || productData.reviews,
        image: (productData.productImages?.[0] as { images?: Record<string, unknown> })?.images?.['200x200'] || productData.image,
        images: productData.productImages?.map((img: { images?: Record<string, unknown> }) => img.images?.['200x200']) || productData.images,
        category: productData.category,
        categoryId: productData.categoryId,
        stock: productData.inStock ? 1 : 0,
        warranty: productData.warranty,
        seller: {
          name: productData.seller?.name || productData.sellerName,
          verified: productData.seller?.verified || false,
        },
      };
    } catch (error) {
      logger.debug('FlipkartParser: Failed to extract from embedded JSON', { error });
      return null;
    }
  }

  private extractFromHtml(extractor: HtmlExtractor): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Title - Try multiple selectors
    let title = extractor.getText('h1');
    if (!title) {
      title = extractor.getText('[class*="title"]');
    }
    if (!title) {
      title = extractor.getText('span[class*="name"]');
    }
    if (title) {
      result.name = title;
    }

    // Price - Try multiple Flipkart-specific selectors
    // let priceText = extractor.getText('._30jeq3 ._3qQ9m1');  // Flipkart price class
    // if (!priceText) {
    //   priceText = extractor.getText('[class*="price"], ._30jeq3, .nlI7Z0');
    // }
    // if (!priceText) {
    //   priceText = extractor.getText('[data-testid*="price"], [id*="price"]');
    // }
    let priceText = extractor.getText('._30jeq3 ._3qQ9m1');
    if (!priceText) {
      priceText = extractor.getText('.v1zwn21m.v1zwn20._1psv1zeb9._1psv1ze0');
    }
    if (!priceText) {
      priceText = extractor.getText('[class*="price"], ._30jeq3, .nlI7Z0');
    }
    if (!priceText) {
      priceText = extractor.getText('[data-testid*="price"], [id*="price"]');
    }
    const price = sanitizePrice(priceText);
    if (price && price > 0) {
      result.price = price;
    }

    // Rating - Try multiple selectors
    // let ratingText = extractor.getText('._3LWZlK');  // Flipkart rating class
    // if (!ratingText) {
    //   ratingText = extractor.getText('[class*="rating"]');
    // }
    // if (!ratingText) {
    //   ratingText = extractor.getText('[data-testid*="rating"]');
    // }
    const ratingText = extractor.extractRating();
    const rating = ratingText;
    if (!isNaN(rating) && rating > 0) {
      result.rating = rating;
    }

    // Images - Try multiple selectors
    // let images = extractor.getImages('._2r_T1I img');  // Flipkart image container
    // if (images.length === 0) {
    //   images = extractor.getImages('[class*="image"] img');
    // }
    // if (images.length === 0) {
    //   images = extractor.getImages('img[class*="product"]');
    // }
    // if (images.length > 0) {
    //   result.image = images[0];
    //   result.images = images.slice(0, 10);
    // }
    let images = extractor.getImages('img');
    // Prefer Flipkart CDN images
    images = images.filter(img =>
      img.includes('rukminim')
    );
    if (images.length > 0) {
      result.image = images[0];
      result.images = images.slice(0, 10);
    }

    // Brand - Try multiple selectors
    // let brand = extractor.getText('._35KyD6');  // Flipkart brand class
    // if (!brand) {
    //   brand = extractor.getText('[class*="brand"]');
    // }
    // if (!brand) {
    //   brand = extractor.getText('a[href*="/br/"]');  // Flipkart brand link
    // }
    // if (brand) {
    //   result.brand = brand;
    // }
    let brand = extractor.getText('._35KyD6');

    if (!brand) {
      brand = extractor.getText('[class*="brand"]');
    }

    if (!brand) {
      brand = extractor.getText('a[href*="/br/"]');
    }

    // Fallback from title
    if (!brand && result.name) {
      const name = (result.name) as string;
      brand = name.split(/\s+/)[0];
    }

    if (brand) {
      result.brand = brand;
    }

    // // Description - Try multiple selectors
    // let description = extractor.getText('._1mXcCf');  // Flipkart description class
    // if (!description) {
    //   description = extractor.getText('[class*="description"]');
    // }
    // if (!description) {
    //   description = extractor.getText('div[class*="detail"]');
    // }
    // if (description) {
    //   result.description = description.substring(0, 500);
    // }
    let description = extractor.getProductDescription();

    if (description) {
      result.description = description.substring(0, 500);
    }

    // Seller info - Try multiple selectors
    let sellerName = extractor.getText('._27Z9O-, ._2gUAhX');  // Flipkart seller class
    if (!sellerName) {
      sellerName = extractor.getText('[class*="seller"]');
    }
    if (sellerName) {
      result.seller = {
        name: sellerName.trim(),
        verified: extractor.exists('[class*="verified"], [class*="seller-badge"]'),
      };
    }

    // Reviews count
    result.reviews = extractor.extractRatingCount();
    // let reviewsText = extractor.getText('._2_R_DZ');  // Flipkart reviews class
    // if (reviewsText) {
    //   const reviewsMatch = reviewsText.match(/[\d,]+/);
    //   if (reviewsMatch) {
    //     result.reviews = parseInt(reviewsMatch[0].replace(/,/g, ''), 10);
    //   }
    // }

    // Stock/Availability
    const availabilityText = extractor.getText('[class*="stock"], [class*="availability"]');
    if (availabilityText) {
      result.stock = availabilityText.toLowerCase().includes('out of stock') ? 0 : 1;
    }

    return result;
  }
}

export default FlipkartParser;
