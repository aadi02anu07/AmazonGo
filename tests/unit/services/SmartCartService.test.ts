/**
 * Unit tests for SmartCartService
 * Requirements: Smart Cart (Tasks 5.2)
 */

import {
  getSmartCart,
  refreshSmartCart,
  invalidateSmartCart,
} from '@services/SmartCartService';
import { AppError } from '@constants/errors';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@adapters/factory', () => ({
  recommendationAdapter: {
    getRecommendations: jest.fn(),
    getSmartCartTier: jest.fn(),
  },
  cacheAdapter: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    mget: jest.fn(),
  },
}));

import { recommendationAdapter, cacheAdapter } from '@adapters/factory';

const mockedGetRecommendations = jest.mocked(recommendationAdapter.getRecommendations);
const mockedGetSmartCartTier = jest.mocked(recommendationAdapter.getSmartCartTier);
const mockedCacheGet = jest.mocked(cacheAdapter.get);
const mockedCacheSet = jest.mocked(cacheAdapter.set);
const mockedCacheDel = jest.mocked(cacheAdapter.del);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Fixtures
// ============================================================================

const userId = 'user_001';
const pincode = '110001';

const recommendationFixture = [
  {
    productId: 'prod_amul_milk',
    name: 'Amul Gold Milk 500ml',
    brand: 'Amul',
    price: 3200,
    imageUrl: 'https://cdn.snap.dev/amul-milk.jpg',
    confidence: 0.9,
    reason: 'Popular in your area',
  },
];

// ============================================================================
// getSmartCart — cache hit
// ============================================================================

describe('getSmartCart', () => {
  it('cache hit: returns cached SmartCartResult without calling the adapter', async () => {
    const cached = {
      userId,
      pincode,
      tier: 'trending' as const,
      label: 'Popular Near You',
      suggestions: recommendationFixture,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };

    mockedCacheGet.mockResolvedValueOnce(cached);

    const result = await getSmartCart(userId, pincode);

    expect(result).toEqual(cached);
    expect(mockedGetSmartCartTier).not.toHaveBeenCalled();
    expect(mockedGetRecommendations).not.toHaveBeenCalled();
  });

  // ============================================================================
  // cache miss + Tier 1 (trending) user
  // ============================================================================

  it('cache miss + Tier 1 user: calls adapter, caches result, returns SmartCartResult with label "Popular Near You"', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetSmartCartTier.mockResolvedValueOnce('trending');
    mockedGetRecommendations.mockResolvedValueOnce(recommendationFixture);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await getSmartCart(userId, pincode);

    expect(result.tier).toBe('trending');
    expect(result.label).toBe('Popular Near You');
    expect(result.userId).toBe(userId);
    expect(result.pincode).toBe(pincode);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.productId).toBe('prod_amul_milk');
    expect(result.generatedAt).toBeTruthy();

    expect(mockedCacheGet).toHaveBeenCalledWith(`smartcart:${userId}`);
    expect(mockedGetSmartCartTier).toHaveBeenCalledWith(userId);
    expect(mockedGetRecommendations).toHaveBeenCalledWith(userId, pincode, 8);
    expect(mockedCacheSet).toHaveBeenCalledWith(
      `smartcart:${userId}`,
      expect.objectContaining({ tier: 'trending' }),
      21600
    );
  });

  // ============================================================================
  // cache miss + Tier 3 (personalize) user
  // ============================================================================

  it('cache miss + Tier 3 user: returns SmartCartResult with label "Your Smart Cart"', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetSmartCartTier.mockResolvedValueOnce('personalize');
    mockedGetRecommendations.mockResolvedValueOnce(recommendationFixture);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await getSmartCart(userId, pincode);

    expect(result.tier).toBe('personalize');
    expect(result.label).toBe('Your Smart Cart');
  });

  // ============================================================================
  // no products → NO_PRODUCTS_AVAILABLE
  // ============================================================================

  it('no in-stock products: throws AppError NO_PRODUCTS_AVAILABLE (422)', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetSmartCartTier.mockResolvedValueOnce('trending');
    mockedGetRecommendations.mockResolvedValueOnce([]);

    const error = await getSmartCart(userId, pincode).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'NO_PRODUCTS_AVAILABLE',
      statusCode: 422,
    });
  });

  // ============================================================================
  // tier resolution failure → USER_NOT_FOUND
  // ============================================================================

  it('getSmartCartTier throws: propagates as AppError USER_NOT_FOUND (404)', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetSmartCartTier.mockRejectedValueOnce(new Error('User table read error'));

    const error = await getSmartCart(userId, pincode).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ============================================================================
// Tier label correctness
// ============================================================================

describe('tier labels', () => {
  it('trending tier maps to "Popular Near You"', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetSmartCartTier.mockResolvedValueOnce('trending');
    mockedGetRecommendations.mockResolvedValueOnce(recommendationFixture);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await getSmartCart(userId, pincode);
    expect(result.label).toBe('Popular Near You');
  });

  it('hybrid tier maps to "Based on Your Orders"', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetSmartCartTier.mockResolvedValueOnce('hybrid');
    mockedGetRecommendations.mockResolvedValueOnce(recommendationFixture);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await getSmartCart(userId, pincode);
    expect(result.label).toBe('Based on Your Orders');
  });

  it('personalize tier maps to "Your Smart Cart"', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetSmartCartTier.mockResolvedValueOnce('personalize');
    mockedGetRecommendations.mockResolvedValueOnce(recommendationFixture);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await getSmartCart(userId, pincode);
    expect(result.label).toBe('Your Smart Cart');
  });
});

// ============================================================================
// refreshSmartCart
// ============================================================================

describe('refreshSmartCart', () => {
  it('deletes cache key then generates a fresh SmartCartResult', async () => {
    mockedCacheDel.mockResolvedValueOnce(undefined);
    // After del, getSmartCart is called — cache should miss
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetSmartCartTier.mockResolvedValueOnce('hybrid');
    mockedGetRecommendations.mockResolvedValueOnce(recommendationFixture);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await refreshSmartCart(userId, pincode);

    expect(mockedCacheDel).toHaveBeenCalledWith(`smartcart:${userId}`);
    expect(result.tier).toBe('hybrid');
    expect(result.label).toBe('Based on Your Orders');
    expect(result.suggestions).toHaveLength(1);
  });
});

// ============================================================================
// invalidateSmartCart
// ============================================================================

describe('invalidateSmartCart', () => {
  it('calls cacheAdapter.del with the correct key', async () => {
    mockedCacheDel.mockResolvedValueOnce(undefined);

    await invalidateSmartCart(userId);

    expect(mockedCacheDel).toHaveBeenCalledWith(`smartcart:${userId}`);
  });

  it('does not throw when cacheAdapter.del rejects', async () => {
    mockedCacheDel.mockRejectedValueOnce(new Error('Redis error'));

    await expect(invalidateSmartCart(userId)).resolves.toBeUndefined();
  });
});
