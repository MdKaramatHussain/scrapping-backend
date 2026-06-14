import * as cheerio from 'cheerio';
import logger from '../../config/logger';

/**
 * Generic HTML Extractor
 * Provides utilities for extracting data from HTML using Cheerio
 */
export class HtmlExtractor {
  private $: cheerio.CheerioAPI;

  constructor(html: string) {
    this.$ = cheerio.load(html);
  }

  /**
   * Extract text from element
   */
  getText(selector: string): string {
    const text = this.$(selector).text();
    return text ? text.trim() : '';
  }

  /**
   * Extract Description
  */
  getProductDescription(): string {

    const highlights: string[] = [];

    const heading = this.$('div').filter((_, el) => {
      return this.$(el).text().trim() === 'Product highlights';
    });

    if (!heading.length) {
      return '';
    }

    // Look near the heading
    heading.parent().find('div').each((_, el) => {
      const text = this.$(el).text().trim();

      if (
        text &&
        text !== 'Product highlights' &&
        text.length < 100
      ) {
        highlights.push(text);
      }
    });

    return [...new Set(highlights)].join(' | ');
  }


  /**
   * Extract rating
   */
  extractRating(): number {
    let rating = 0;

    this.$('*').each((_, el) => {
      const text = this.$(el).text().trim();

      const match = text.match(/^([1-5]\.\d)$/);

      if (match) {
        rating = parseFloat(match[1]);
        return false;
      }
    });

    return rating;
  }

  /**
   * Extract Rating count
  */
  extractRatingCount(): number {
  let reviews = 0;

  this.$('*').each((_, el) => {
    const text = this.$(el)
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    // Match the number immediately before "ratings"
    const match = text.match(/([\d,]+)\s+ratings/i);

    if (match) {
      reviews = parseInt(
        match[1].replace(/,/g, ''),
        10
      );

      return false;
    }
  });

  return reviews;
}


  /**
   * Extract all text nodes matching selector
   */
  getAllText(selector: string): string[] {
    const texts: string[] = [];
    this.$(selector).each((_, el) => {
      const text = this.$(el).text().trim();
      if (text) {
        texts.push(text);
      }
    });
    return texts;
  }

  /**
   * Extract attribute
   */
  getAttribute(selector: string, attr: string): string {
    return this.$(selector).attr(attr) || '';
  }

  /**
   * Extract all attributes matching selector
   */
  getAllAttributes(selector: string, attr: string): string[] {
    const attrs: string[] = [];
    this.$(selector).each((_, el) => {
      const value = this.$(el).attr(attr);
      if (value) {
        attrs.push(value);
      }
    });
    return attrs;
  }

  /**
   * Extract HTML
   */
  getHtml(selector: string): string {
    return this.$(selector).html() || '';
  }

  /**
   * Check if element exists
   */
  exists(selector: string): boolean {
    return this.$(selector).length > 0;
  }

  /**
   * Extract meta tag content
   */
  getMetaContent(name: string): string {
    return (
      this.$(`meta[name="${name}"]`).attr('content') ||
      this.$(`meta[property="${name}"]`).attr('content') ||
      ''
    );
  }

  /**
   * Extract all meta tags as object
   */
  getAllMetaTags(): Record<string, string> {
    const meta: Record<string, string> = {};
    this.$('meta').each((_, el) => {
      const name = this.$(el).attr('name') || this.$(el).attr('property');
      const content = this.$(el).attr('content');
      if (name && content) {
        meta[name] = content;
      }
    });
    return meta;
  }

  /**
   * Extract JSON-LD structured data
   */
  getJsonLd(): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];
    this.$('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse(this.$(el).html() || '');
        results.push(json);
      } catch (error) {
        logger.debug('Failed to parse JSON-LD', { error });
      }
    });
    return results;
  }

  /**
   * Extract OG tags
   */
  getOgTags(): Record<string, string> {
    const og: Record<string, string> = {};
    this.$('meta[property^="og:"]').each((_, el) => {
      const property = this.$(el).attr('property') || '';
      const content = this.$(el).attr('content') || '';
      const key = property.replace('og:', '');
      og[key] = content;
    });
    return og;
  }

  /**
   * Extract images from HTML
   */
  // getImages(selector: string = 'img'): string[] {
  //   const images: string[] = [];
  //   this.$(selector).each((_, el) => {
  //     const src = this.$(el).attr('src') || this.$(el).attr('data-src');
  //     if (src && src.startsWith('http')) {
  //       images.push(src);
  //     }
  //   });
  //   return images;
  // }
  getImages(selector: string = 'img'): string[] {
    const images = new Set<string>();

    this.$(selector).each((_, el) => {
      const $el = this.$(el);

      const src = $el.attr('src');
      if (src?.startsWith('http')) {
        images.add(src);
      }

      const dataSrc = $el.attr('data-src');
      if (dataSrc?.startsWith('http')) {
        images.add(dataSrc);
      }

      const srcset = $el.attr('srcset');
      if (srcset) {
        srcset.split(',').forEach(item => {
          const url = item.trim().split(' ')[0];

          if (url.startsWith('http')) {
            images.add(url);
          }
        });
      }
    });

    return [...images];
  }

  /**
   * Extract links
   */
  getLinks(selector: string = 'a'): Array<{ text: string; href: string }> {
    const links: Array<{ text: string; href: string }> = [];
    this.$(selector).each((_, el) => {
      const href = this.$(el).attr('href');
      const text = this.$(el).text();
      if (href) {
        links.push({ text: text.trim(), href });
      }
    });
    return links;
  }
}

export default HtmlExtractor;
