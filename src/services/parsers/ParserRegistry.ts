import { MarketplaceParser } from '../../interfaces';
import FlipkartParser from './FlipkartParser';
import AmazonParser from './AmazonParser';
import MyntraParser from './MyntraParser';
import AjioParser from './AjioParser';
import logger from '../../config/logger';

/**
 * Parser Registry
 * Manages and selects appropriate parsers for different marketplaces
 */
export class ParserRegistry {
  private parsers: MarketplaceParser[] = [];

  constructor() {
    this.registerDefaultParsers();
  }

  /**
   * Register default marketplace parsers
   */
  private registerDefaultParsers(): void {
    this.register(new FlipkartParser());
    this.register(new AmazonParser());
    this.register(new MyntraParser());
    this.register(new AjioParser());
    logger.info('ParserRegistry: Registered default parsers');
  }

  /**
   * Register a new marketplace parser
   */
  register(parser: MarketplaceParser): void {
    // Remove existing parser with same name to avoid duplicates
    this.parsers = this.parsers.filter((p) => p.name !== parser.name);
    this.parsers.push(parser);
    // Sort by priority (highest first)
    this.parsers.sort((a, b) => b.priority - a.priority);
    logger.info(`ParserRegistry: Registered parser: ${parser.name}`);
  }

  /**
   * Get parser for URL
   */
  getParser(url: string): MarketplaceParser | null {
    const parser = this.parsers.find((p) => p.canHandle(url));
    if (parser) {
      logger.debug(`ParserRegistry: Selected parser ${parser.name} for URL`, { url });
    } else {
      logger.debug('ParserRegistry: No specific parser found for URL', { url });
    }
    return parser || null;
  }

  /**
   * Get all registered parsers
   */
  getParsers(): MarketplaceParser[] {
    return [...this.parsers];
  }

  /**
   * Get parser count
   */
  getParserCount(): number {
    return this.parsers.length;
  }
}

// Create global instance
export const parserRegistry = new ParserRegistry();

export default ParserRegistry;
