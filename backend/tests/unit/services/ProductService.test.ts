/**
 * Unit tests for ProductService
 * Requirements: 13.1–13.10
 */

import {
  getProductById,
  searchProducts,
  getTrendingProducts,
  getProductByBarcode,
} from '@services/ProductService';
import { AppError } from '@constants/errors';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@clients/dynamoClient', () => ({
  getItem: jest.fn(),
  queryItems: jest.fn(),
  scanItems: jest.fn(),
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

// Import mocked modules for type-safe access
import { queryItems, scanItems } from '@clients/dynamoClient';
import { searchAdapter, cacheAdapter } from '@adapters/factory';

const mockedQueryItems = jest.mocked(queryItems);
const mockedScanItems = jest.mocked(scanItems);
const mockedSearchAdapterSearch = jest.mocked(searchAdapter.search);
const mockedSearchAdapterGetTrending = jest.mocked(searchAdapter.getTrending);
const mockedCacheAdapterGet = jest.mocked(cacheAdapter.get);
const mockedCacheAdapterSet = jest.mocked(cacheAdapter.set);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Fixtures
// ============================================================================

const productFixture = {
  productId: 'prod_amul_milk_500',
  sku: 'SKU-AMK-500',
  name: 'Amul Gold Milk 500ml',
  brand: 'Amul',
  category: 'grocery',
  subCategory: 'dairy',
  description: 'Fresh pasteurized Amul Gold Milk',
  imageUrls: ['https://cdn.snap.dev/products/amul-milk-500.jpg'],
  price: 3200,
  mrp: 3500,
  unit: '500ml',
  tags: ['milk', 'dairy', 'amul', 'gold', '500ml'],
  weight: '500g',
  barcodes: ['8901396047919'],
  rekognitionLabels: ['Milk', 'Dairy', 'Bottle'],
  isAvailable: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const searchResultFixture = [
  {
    productId: 'prod_amul_milk_500',
    name: 'Amul Gold Milk 500ml',
    brand: 'Amul',
    category: 'grocery',
    subCategory: 'dairy',
    price: 3200,
    mrp: 3500,
    unit: '500ml',
    imageUrls: ['https://cdn.snap.dev/products/amul-milk-500.jpg'],
    tags: ['milk', 'dairy'],
    isAvailable: true,
    score: 0.95,
    imageUrl: 'https://cdn.snap.dev/products/amul-milk-500.jpg',
  },
];

// ============================================================================
// getProductById
// ============================================================================

describe('getProductById', () => {
  it('Req 13.1 — found: returns the product when queryItems resolves with a product', async () => {
    mockedCacheAdapterGet.mockResolvedValueOnce(null);
    mockedQueryItems.mockResolvedValueOnce({ items: [productFixture], nextCursor: undefined });
    mockedCacheAdapterSet.mockResolvedValueOnce(undefined);

    const result = await getProductById('prod_amul_milk_500');

    expect(result).toEqual(productFixture);
    expect(mockedQueryItems).toHaveBeenCalled();
  });

  it('Req 13.2 — not found: throws AppError PRODUCT_NOT_FOUND (404) when queryItems returns empty', async () => {
    mockedCacheAdapterGet.mockResolvedValueOnce(null);
    mockedQueryItems.mockResolvedValue({ items: [], nextCursor: undefined });

    const error = await getProductById('nonexistent').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ============================================================================
// searchProducts
// ============================================================================

describe('searchProducts', () => {
  it('Req 13.3 — delegates unchanged: returns exactly what searchAdapter.search returns', async () => {
    mockedSearchAdapterSearch.mockResolvedValueOnce(searchResultFixture);

    const result = await searchProducts('milk', '110001', 'grocery', 10);

    expect(result).toEqual(searchResultFixture);
    expect(mockedSearchAdapterSearch).toHaveBeenCalledWith('milk', '110001', 'grocery', 10);
  });
});

// ============================================================================
// getTrendingProducts
// ============================================================================

describe('getTrendingProducts', () => {
  it('Req 13.4 — cache hit: returns cached value without calling searchAdapter.getTrending', async () => {
    mockedCacheAdapterGet.mockResolvedValueOnce(searchResultFixture);

    const result = await getTrendingProducts('110001');

    expect(result).toEqual(searchResultFixture);
    expect(mockedSearchAdapterGetTrending).not.toHaveBeenCalled();
    expect(mockedCacheAdapterGet).toHaveBeenCalledWith('trending:110001');
  });

  it('Req 13.5 — cache miss: calls getTrending, sets cache with 900s TTL, returns result', async () => {
    mockedCacheAdapterGet.mockResolvedValueOnce(null);
    mockedSearchAdapterGetTrending.mockResolvedValueOnce(searchResultFixture);
    mockedCacheAdapterSet.mockResolvedValueOnce(undefined);

    const result = await getTrendingProducts('110001');

    expect(result).toEqual(searchResultFixture);
    expect(mockedSearchAdapterGetTrending).toHaveBeenCalledWith('110001', 10);
    expect(mockedCacheAdapterSet).toHaveBeenCalledWith(
      'trending:110001',
      searchResultFixture,
      900
    );
  });

  it('Req 13.9 — cache.get throws: error is swallowed, getTrending is still called and result returned', async () => {
    mockedCacheAdapterGet.mockRejectedValueOnce(new Error('Redis connection error'));
    mockedSearchAdapterGetTrending.mockResolvedValueOnce(searchResultFixture);
    mockedCacheAdapterSet.mockResolvedValueOnce(undefined);

    const result = await getTrendingProducts('110001');

    expect(result).toEqual(searchResultFixture);
    expect(mockedSearchAdapterGetTrending).toHaveBeenCalledWith('110001', 10);
  });
});

// ============================================================================
// getProductByBarcode
// ============================================================================

describe('getProductByBarcode', () => {
  it('Req 13.6 — cache hit: returns cached product without calling scanItems', async () => {
    mockedCacheAdapterGet.mockResolvedValueOnce(productFixture);

    const result = await getProductByBarcode('8901396047919');

    expect(result).toEqual(productFixture);
    expect(mockedScanItems).not.toHaveBeenCalled();
    expect(mockedCacheAdapterGet).toHaveBeenCalledWith('barcode:8901396047919');
  });

  it('Req 13.7 — cache miss, found: scans DynamoDB, sets cache with 3600s TTL, returns product', async () => {
    mockedCacheAdapterGet.mockResolvedValueOnce(null);
    mockedScanItems.mockResolvedValueOnce([productFixture]);
    mockedCacheAdapterSet.mockResolvedValueOnce(undefined);

    const result = await getProductByBarcode('8901396047919');

    expect(result).toEqual(productFixture);
    expect(mockedCacheAdapterSet).toHaveBeenCalledWith(
      'barcode:8901396047919',
      productFixture,
      3600
    );
  });

  it('Req 13.8 — cache miss, not found: throws AppError BARCODE_NOT_FOUND when scanItems returns empty array', async () => {
    mockedCacheAdapterGet.mockResolvedValue(null);
    mockedScanItems.mockResolvedValue([]);

    const error = await getProductByBarcode('0000000000000').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'BARCODE_NOT_FOUND',
    });
  });

  it('Req 13.10 — cache.set throws: error is swallowed, product is still returned normally', async () => {
    mockedCacheAdapterGet.mockResolvedValueOnce(null);
    mockedScanItems.mockResolvedValueOnce([productFixture]);
    mockedCacheAdapterSet.mockRejectedValueOnce(new Error('Redis write error'));

    const result = await getProductByBarcode('8901396047919');

    expect(result).toEqual(productFixture);
  });
});
