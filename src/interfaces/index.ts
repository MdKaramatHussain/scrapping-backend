/**
 * Marketplace Parser Interface
 */
export interface MarketplaceParser {
  canHandle(url: string): boolean;
  parse(html: string, url: string): Promise<Partial<Record<string, unknown>>>;
  name: string;
  priority: number;
}

/**
 * Proxy Provider Interface
 */
export interface ProxyProvider {
  getProxy(): Promise<string | null>;
  validateProxy(proxy: string): Promise<boolean>;
}

/**
 * Browser Pool Configuration
 */
export interface BrowserPoolConfig {
  poolSize: number;
  timeout: number;
  headless: boolean;
}

/**
 * Logger Interface
 */
export interface ILogger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}
