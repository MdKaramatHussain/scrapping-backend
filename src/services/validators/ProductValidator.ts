import { z } from 'zod';
import { Product } from '../../types/product';
import logger from '../../config/logger';

/**
 * Zod validation schema for Product
 */
const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  category: z.string().optional(),
  categoryId: z.string().optional(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  discount: z.number().min(0).max(100).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviews: z.number().min(0).optional(),
  stock: z.number().min(0).optional(),
  image: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  thumbnail: z.string().url().optional(),
  specs: z.record(z.string(), z.unknown()).optional(),
  warranty: z.string().optional(),
  delivery: z.string().optional(),
  createdAt: z.date().optional(),
  seller: z
    .object({
      id: z.string().optional(),
      name: z.string(),
      verified: z.boolean().optional(),
      rating: z.number().optional(),
    })
    .optional(),
  seoDescription: z.string().optional(),
  seoTitle: z.string().optional(),
  isFeatured: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  fastDelivery: z.boolean().optional(),
  badges: z.array(z.string()).optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  sku: z.string().optional(),
});

/**
 * Validation result with warnings
 */
export interface ValidationResult {
  valid: boolean;
  data: Partial<Product>;
  errors: string[];
  warnings: string[];
  confidence: number;
}

/**
 * Product Validator
 */
export class ProductValidator {
  /**
   * Validate and normalize product data
   */
  static validate(data: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;

    // Check if data is an object
    if (!data || typeof data !== 'object') {
      errors.push('Data must be an object');
      return { valid: false, data: {}, errors, warnings, confidence: 0 };
    }

    const obj = data as Record<string, unknown>;

    // Check required fields
    if (!obj.name || typeof obj.name !== 'string' || obj.name.trim().length === 0) {
      errors.push('Product name is required');
      confidence -= 0.3;
    }

    if (typeof obj.price !== 'number' || obj.price <= 0) {
      errors.push('Valid price is required');
      confidence -= 0.3;
    }

    // Check optional fields and add warnings
    if (!obj.brand || typeof obj.brand !== 'string' || obj.brand.trim().length === 0) {
      warnings.push('Brand information missing');
      confidence -= 0.1;
    }

    if (!obj.image || typeof obj.image !== 'string') {
      warnings.push('Product image missing');
      confidence -= 0.15;
    }

    if (!obj.description || typeof obj.description !== 'string' || obj.description.trim().length === 0) {
      warnings.push('Product description missing');
      confidence -= 0.05;
    }

    if (!obj.seller || typeof obj.seller !== 'object') {
      warnings.push('Seller information missing');
      confidence -= 0.1;
    }

    if (typeof obj.rating !== 'number') {
      warnings.push('Rating information missing');
      confidence -= 0.05;
    }

    if (typeof obj.reviews !== 'number') {
      warnings.push('Reviews count missing');
      confidence -= 0.05;
    }

    if (typeof obj.warranty !== 'string') {
      warnings.push('Warranty information missing');
      confidence -= 0.05;
    }

    // Normalize data
    const sellerObj = obj.seller && typeof obj.seller === 'object' ? (obj.seller as Record<string, unknown>) : undefined;
    const normalized: Partial<Product> = {
      name: typeof obj.name === 'string' ? obj.name.trim() : '',
      price: typeof obj.price === 'number' ? obj.price : 0,
      brand: typeof obj.brand === 'string' ? obj.brand.trim() : 'Unknown',
      image: typeof obj.image === 'string' ? obj.image : '',
      description: typeof obj.description === 'string' ? obj.description : '',
      category: typeof obj.category === 'string' ? obj.category : 'Uncategorized',
      categoryId: typeof obj.categoryId === 'string' ? obj.categoryId : '',
      subcategory: typeof obj.subcategory === 'string' ? obj.subcategory : '',
      originalPrice: typeof obj.originalPrice === 'number' ? obj.originalPrice : undefined,
      discount:
        typeof obj.discount === 'number' && obj.discount >= 0 && obj.discount <= 100
          ? obj.discount
          : undefined,
      rating: typeof obj.rating === 'number' && obj.rating >= 0 && obj.rating <= 5 ? obj.rating : 0,
      reviews: typeof obj.reviews === 'number' && obj.reviews >= 0 ? obj.reviews : 0,
      stock: typeof obj.stock === 'number' && obj.stock >= 0 ? obj.stock : 0,
      images: Array.isArray(obj.images) ? obj.images.filter((img) => typeof img === 'string') : [],
      specs:
        obj.specs && typeof obj.specs === 'object' && !Array.isArray(obj.specs)
          ? (obj.specs as Record<string, unknown>)
          : {},
      warranty: typeof obj.warranty === 'string' ? obj.warranty : '',
      delivery: typeof obj.delivery === 'string' ? obj.delivery : '',
      createdAt: new Date(),
      seller:
        sellerObj
          ? {
              id: typeof sellerObj.id === 'string' ? sellerObj.id : 'unknown',
              name: typeof sellerObj.name === 'string' ? sellerObj.name : 'Unknown Seller',
              verified: typeof sellerObj.verified === 'boolean' ? sellerObj.verified : false,
              rating: typeof sellerObj.rating === 'number' ? sellerObj.rating : undefined,
            }
          : {
              id: 'unknown',
              name: 'Unknown Seller',
              verified: false,
            },
    };

    const valid = errors.length === 0;
    confidence = Math.max(0, Math.min(1, confidence));

    logger.debug('Product validation completed', {
      valid,
      confidence,
      warnings: warnings.length,
      errors: errors.length,
    });

    return {
      valid,
      data: normalized,
      errors,
      warnings,
      confidence,
    };
  }
}

export default ProductValidator;
