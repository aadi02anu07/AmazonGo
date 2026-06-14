/**
 * Amazon Now Snap — Product Service
 *
 * Business-logic layer for product queries.
 * Pure functions with no direct AWS SDK usage — delegates to DynamoHelpers and Adapters.
 *
 * Routes served:
 *   GET /v1/products/{productId}
 *   GET /v1/products/search
 *   GET /v1/products/trending
 *   GET /v1/products/barcode/{code}
 *
 * Auth: JWT Bearer token required (userId extracted by handlers, not here)
 * Model: @models/Product
 */

import { queryItems, scanItems, TABLE_NAMES } from '@clients/dynamoClient';
import { searchAdapter, cacheAdapter } from '@adapters/factory';
import { logger } from '@utils/logger';
import { AppError, ErrorCodes } from '@constants/errors';
import { Product, SearchResult } from '@models/Product';
import { SearchResult as AdapterSearchResult } from '@adapters/interfaces';

// ============================================================================
// getProductById
// ============================================================================

/**
 * Get a product by its ID.
 * Cache-first with 3600 second TTL. Cache errors are silently swallowed.
 * Throws AppError PRODUCT_NOT_FOUND (404) when not found.
 */
export async function getProductById(productId: string): Promise<Product> {
  const cacheKey = 'product:' + productId;
  return withCache<Product>(cacheKey, 3600, async () => {
    // Products table has composite key (productId PK + sku SK) so we use
    // queryItems on the PK alone instead of getItem which requires both keys.
    const { items } = await queryItems<Product>({
      tableName: TABLE_NAMES.PRODUCTS,
      keyConditionExpression: 'productId = :productId',
      expressionAttributeValues: { ':productId': productId },
      limit: 1,
    });
    if (items.length === 0) {
      throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found', 404);
    }
    return items[0]!;
  });
}

// ============================================================================
// searchProducts
// ============================================================================

/**
 * Search for products by query, pincode, and optional category.
 * Delegates to the search adapter — returns its result unchanged.
 * Requirements 8.1, 8.2
 */
export async function searchProducts(
  query: string,
  pincode: string,
  category?: string,
  limit?: number
): Promise<SearchResult[]> {
  const results: AdapterSearchResult[] = await searchAdapter.search(
    query,
    pincode,
    category,
    limit ?? 20
  );
  return results as unknown as SearchResult[];
}

// ============================================================================
// withCache (private helper)
// ============================================================================

// Shared cache helper — extracts cache-read/write logic to keep public functions ≤50 lines
// Cache errors are silently swallowed (cache is a performance optimization, not a correctness dependency)
async function withCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  let cached: T | null = null;
  try {
    cached = await cacheAdapter.get<T>(key);
  } catch (e) {
    logger.error({ message: 'Cache get error', error: e });
  }

  if (cached !== null) {
    return cached;
  }

  const result = await loader();

  try {
    await cacheAdapter.set(key, result, ttlSeconds);
  } catch (e) {
    logger.error({ message: 'Cache set error', error: e });
  }

  return result;
}

// ============================================================================
// getTrendingProducts
// ============================================================================

/**
 * Get trending products for a pincode.
 * Cache-first with 900 second TTL. Cache errors are silently swallowed.
 * Requirements: 8.3, 8.5
 */
export async function getTrendingProducts(
  pincode: string,
  limit?: number
): Promise<SearchResult[]> {
  const cacheKey = 'trending:' + pincode;
  return withCache<SearchResult[]>(cacheKey, 900, async () => {
    const results = await searchAdapter.getTrending(pincode, limit ?? 10);
    return results as unknown as SearchResult[];
  });
}

// ============================================================================
// getProductByBarcode
// ============================================================================

/**
 * Get a product by barcode.
 * Cache-first with 3600 second TTL. Cache errors are silently swallowed.
 * Throws AppError BARCODE_NOT_FOUND (404) when not found.
 * Uses FilterExpression on the barcodes array since products store barcodes
 * as a list attribute (no scalar BarcodeIndex GSI needed).
 */
export async function getProductByBarcode(barcode: string): Promise<Product> {
  const cacheKey = 'barcode:' + barcode;
  return withCache<Product>(cacheKey, 3600, async () => {
    const items = await scanItems<Product>({
      tableName: TABLE_NAMES.PRODUCTS,
      filterExpression: 'contains(barcodes, :barcode)',
      expressionAttributeValues: { ':barcode': barcode },
    });
    if (items.length === 0) {
      throw new AppError(ErrorCodes.BARCODE_NOT_FOUND, 'Barcode not found', 404);
    }
    return items[0]!;
  });
}
