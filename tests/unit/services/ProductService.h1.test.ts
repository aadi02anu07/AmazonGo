/**
 * Phase H1 additional unit tests for ProductService
 *
 * Covers:
 *  - getProductById: cache hit, cache miss + DB hit, not found
 *  - getProductByBarcode: not found → BARCODE_NOT_FOUND
 *  - searchProducts: default limit (20)
 *  - getTrendingProducts: cache miss sets 900s TTL; cache hit skips adapter
 */

import {
  getProductById,
  searchProducts,
  getTrendingProducts,
  getProductByBarcode,
} from '@services/ProductService';
import { AppError, ErrorCodes } from '@constants/errors';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@clients/dynamoClient', () => ({
  getItem: jest.fn(),
  queryItems: jest.fn(),
  TABLE_NAMES: { PRODUCTS: 'Dev-SnapProducts' },
}));

jest.mock('@adapters/factory', () => ({
  searchAdapter: {
    search: jest.fn(),
    getTrending: jest.fn(),
  },
  cacheAdapter: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    mget: jest.fn(),
  },
}));

import { getItem, queryItems } from '@clients/dynamoClient';
import { searchAdapter, cacheAdapter } from '@adapters/factory';
import { buildProduct } from '../../fixtures';

const mockedGetItem = jest.mocked(getItem);
const mockedQueryItems = jest.mocked(queryItems);
const mockedSearchAdapterSearch = jest.mocked(searchAdapter.search);
const mockedSearchAdapterGetTrending = jest.mocked(searchAdapter.getTrending);
const mockedCacheGet = jest.mocked(cacheAdapter.get);
const mockedCacheSet = jest.mocked(cacheAdapter.set);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Fixtures
// ============================================================================

const product = buildProduct();
const searchResults = [
  {
    productId: product.productId,
    name: product.name,
    brand: product.brand,
    category: product.category,
    subCategory: product.subCategory,
    price: product.price,
    mrp: product.mrp,
    unit: product.unit,
    imageUrls: product.imageUrls,
    imageUrl: product.imageUrls[0] ?? '',
    tags: product.tags,
    isAvailable: product.isAvailable,
    score: 0.9,
  },
];

// ============================================================================
// getProductById
// ============================================================================

describe('getProductById — Phase H1', () => {
  it('cache hit: returns cached product without calling getItem', async () => {
    mockedCacheGet.mockResolvedValueOnce(product);

    const result = await getProductById(product.productId);

    expect(result).toEqual(product);
    expect(mockedGetItem).not.toHaveBeenCalled();
    expect(mockedCacheGet).toHaveBeenCalledWith(`product:${product.productId}`);
  });

  it('cache miss then DB hit: calls getItem, sets cache with 3600s TTL, returns product', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetItem.mockResolvedValueOnce(product);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await getProductById(product.productId);

    expect(result).toEqual(product);
    expect(mockedGetItem).toHaveBeenCalledWith('Dev-SnapProducts', {
      productId: product.productId,
    });
    expect(mockedCacheSet).toHaveBeenCalledWith(
      `product:${product.productId}`,
      product,
      3600
    );
  });

  it('cache miss then DB miss: throws AppError PRODUCT_NOT_FOUND (404)', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetItem.mockResolvedValueOnce(null);

    const error = await getProductById('nonexistent_id').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: ErrorCodes.PRODUCT_NOT_FOUND,
      statusCode: 404,
    });
  });
});

// ============================================================================
// getProductByBarcode — BARCODE_NOT_FOUND
// ============================================================================

describe('getProductByBarcode — Phase H1', () => {
  it('cache miss, barcode not found: throws AppError BARCODE_NOT_FOUND (404) — not PRODUCT_NOT_FOUND', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedQueryItems.mockResolvedValueOnce({ items: [] });

    const error = await getProductByBarcode('9999999999999').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: ErrorCodes.BARCODE_NOT_FOUND,
      statusCode: 404,
    });
    // Ensure the old PRODUCT_NOT_FOUND code is NOT used for barcode misses
    expect((error as AppError).code).not.toBe(ErrorCodes.PRODUCT_NOT_FOUND);
  });
});

// ============================================================================
// searchProducts — default limit
// ============================================================================

describe('searchProducts — Phase H1', () => {
  it('passes limit=20 to search adapter when no limit provided', async () => {
    mockedSearchAdapterSearch.mockResolvedValueOnce(searchResults);

    const result = await searchProducts('milk', '110001');

    expect(result).toEqual(searchResults);
    expect(mockedSearchAdapterSearch).toHaveBeenCalledWith('milk', '110001', undefined, 20);
  });

  it('passes caller-supplied limit to search adapter', async () => {
    mockedSearchAdapterSearch.mockResolvedValueOnce(searchResults);

    await searchProducts('milk', '110001', 'grocery', 5);

    expect(mockedSearchAdapterSearch).toHaveBeenCalledWith('milk', '110001', 'grocery', 5);
  });
});

// ============================================================================
// getTrendingProducts — cache behaviour
// ============================================================================

describe('getTrendingProducts — Phase H1', () => {
  it('cache miss: calls getTrending and sets cache with 900s TTL', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedSearchAdapterGetTrending.mockResolvedValueOnce(searchResults);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await getTrendingProducts('110001');

    expect(result).toEqual(searchResults);
    expect(mockedSearchAdapterGetTrending).toHaveBeenCalledWith('110001', 10);
    expect(mockedCacheSet).toHaveBeenCalledWith('trending:110001', searchResults, 900);
  });

  it('cache hit: returns cached value and does NOT call getTrending', async () => {
    mockedCacheGet.mockResolvedValueOnce(searchResults);

    const result = await getTrendingProducts('110001');

    expect(result).toEqual(searchResults);
    expect(mockedSearchAdapterGetTrending).not.toHaveBeenCalled();
    expect(mockedCacheGet).toHaveBeenCalledWith('trending:110001');
  });
});
