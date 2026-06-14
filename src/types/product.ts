/**
 * Product Interface - Normalized product data structure
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryId: string;
  subcategory: string;
  brand: string;
  price: number;
  originalPrice: number;
  discount: number;
  rating: number;
  reviews: number;
  stock: number;
  image: string;
  images: string[];
  thumbnail?: string;
  specs: Record<string, unknown>;
  warranty: string;
  delivery: string;
  createdAt: Date;
  seller: {
    id: string;
    name: string;
    verified: boolean;
    rating?: number;
  };
  seoDescription?: string;
  seoTitle?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
  isNewArrival?: boolean;
  fastDelivery?: boolean;
  badges?: string[];
  color?: string;
  size?: string;
  sku?: string;
}

/**
 * Metadata about the scraping operation
 */
export interface ScrapingMetadata {
  source: string;
  confidence: number;
  originalUrl: string;
  timestamp: Date;
  extractionMethod?: 'initial-state' | 'structured-data' | 'embedded-json' | 'marketplace-parser' | 'html-parser' | 'fallback';
  executionTime?: number;
}

/**
 * API Response for scraping endpoint
 */
export interface ProductImportResult {
  success: boolean;
  product?: Partial<Product>;
  error?: any;
  warnings?: string[];
  metadata?: ScrapingMetadata;
}

/**
 * API Request for scraping
 */
export interface ScrapeRequest {
  url: string;
  marketplace?: string;
  options?: {
    headless?: boolean;
    timeout?: number;
    useProxy?: boolean;
  };
}
