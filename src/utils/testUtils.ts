/**
 * Test utilities for scraping
 */

import { Product } from '../types/product';

/**
 * Mock product data for testing
 */
export const mockProduct: Product = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Product',
  description: 'Test Description',
  category: 'Electronics',
  categoryId: 'cat_001',
  subcategory: 'Smartphones',
  brand: 'Test Brand',
  price: 999.99,
  originalPrice: 1499.99,
  discount: 33.33,
  rating: 4.5,
  reviews: 120,
  stock: 10,
  image: 'https://example.com/product.jpg',
  images: ['https://example.com/product1.jpg', 'https://example.com/product2.jpg'],
  specs: { storage: '128GB', ram: '8GB' },
  warranty: '1 Year',
  delivery: 'Free',
  createdAt: new Date(),
  seller: {
    id: 'seller_001',
    name: 'Test Seller',
    verified: true,
    rating: 4.8,
  },
};

/**
 * Mock HTML for testing
 */
export const mockHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Test Product | Store</title>
      <meta name="description" content="Test product description" />
      <meta property="og:title" content="Test Product" />
      <meta property="og:description" content="Test Description" />
      <meta property="og:image" content="https://example.com/product.jpg" />
      <script type="application/ld+json">
        {
          "@context": "https://schema.org/",
          "@type": "Product",
          "name": "Test Product",
          "image": "https://example.com/product.jpg",
          "description": "Test Description",
          "brand": "Test Brand",
          "offers": {
            "@type": "Offer",
            "price": "999.99",
            "priceCurrency": "INR"
          }
        }
      </script>
    </head>
    <body>
      <h1>Test Product</h1>
      <p class="description">Test Description</p>
      <span class="price">₹999.99</span>
      <img src="https://example.com/product.jpg" alt="Product" />
      <div class="rating">4.5</div>
    </body>
  </html>
`;

/**
 * Generate test URL
 */
export function generateTestUrl(marketplace: string = 'flipkart'): string {
  const urls: Record<string, string> = {
    flipkart: 'https://www.flipkart.com/test-product/p/test123',
    amazon: 'https://www.amazon.in/Test-Product/dp/B0XXXXXXX',
    myntra: 'https://www.myntra.com/test-product/p/XXXXX',
    ajio: 'https://www.ajio.com/test-product/p/XXXXX',
  };

  return urls[marketplace] || urls.flipkart;
}

export default {
  mockProduct,
  mockHtml,
  generateTestUrl,
};
