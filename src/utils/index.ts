/**
 * Utility to validate URLs
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Clean URL (remove query params, fragments)
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 300,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Generate random delay
 */
export function randomDelay(min: number = 500, max: number = 2000): Promise<void> {
  const delay = Math.random() * (max - min) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Sanitize price
 */
export function sanitizePrice(price: unknown): number | null {
  if (typeof price === 'number') {
    return Math.max(0, price);
  }
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return !isNaN(parsed) ? Math.max(0, parsed) : null;
  }
  return null;
}

/**
 * Validate image URL
 */
export function isValidImageUrl(url: unknown): boolean {
  if (typeof url !== 'string') {
    return false;
  }
  try {
    const urlObj = new URL(url);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const path = urlObj.pathname.toLowerCase();
    return imageExtensions.some((ext) => path.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Extract structured data from HTML
 */
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const jsonLdPattern = /<script[^>]*type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = html.matchAll(jsonLdPattern);
  const results: Record<string, unknown>[] = [];

  for (const match of matches) {
    try {
      const json = JSON.parse(match[1]);
      results.push(json);
    } catch {
      // Invalid JSON, skip
    }
  }

  return results;
}

/**
 * Extract all JSON objects from script tags
 */
export function extractScriptJsons(html: string): Record<string, unknown>[] {
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const matches = html.matchAll(scriptPattern);
  const results: Record<string, unknown>[] = [];

  for (const match of matches) {
    const content = match[1];

    // Try to find JSON assignments
    const jsonPatterns = [
      /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/,
      /window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});/,
      /window\.PRELOADED_STATE\s*=\s*(\{[\s\S]*?\});/,
      /var\s+\w+\s*=\s*(\{[\s\S]*?\});/,
    ];

    for (const pattern of jsonPatterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          const json = JSON.parse(match[1]);
          results.push(json);
        } catch {
          // Invalid JSON, skip
        }
      }
    }
  }

  return results;
}
