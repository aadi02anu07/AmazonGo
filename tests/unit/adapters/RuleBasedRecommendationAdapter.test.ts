/**
 * Unit tests for RuleBasedRecommendationAdapter
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */

import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { RuleBasedRecommendationAdapter } from '@adapters/recommendation/RuleBasedRecommendationAdapter';
import { cacheAdapter } from '@adapters/factory';

// ============================================================================
// Mock @adapters/factory so cacheAdapter is a controllable jest mock
// ============================================================================

jest.mock('@adapters/factory', () => ({
  cacheAdapter: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    mget: jest.fn(),
  },
}));

// ============================================================================
// DynamoDB document client mock
// ============================================================================

const ddbMock = mockClient(DynamoDBDocumentClient);

// Typed reference to mocked cacheAdapter
const mockedCacheAdapter = cacheAdapter as {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  mget: jest.Mock;
};

// ============================================================================
// Helpers
// ============================================================================

/** Build a minimal SnapUsers Item with the given totalOrders */
function userItem(totalOrders: number) {
  return { userId: 'u1', totalOrders };
}

/** Build a minimal SnapProducts ScanCommand response */
function productsResponse(count: number) {
  const items = Array.from({ length: count }, (_, i) => ({
    productId: `prod-${i}`,
    name: `Product ${i}`,
    brand: `Brand ${i}`,
    price: 100 + i,
    imageUrls: [`https://img.example.com/${i}.jpg`],
    isAvailable: true,
  }));
  return { Items: items };
}

// ============================================================================
// Suite setup
// ============================================================================

beforeEach(() => {
  ddbMock.reset();
  jest.clearAllMocks();

  // Default: updateUserTier GetCommand resolves without error (fire-and-forget path)
  // This handles any extra GetCommand calls from updateUserTier
  ddbMock.on(GetCommand).resolves({ Item: undefined });
});

// ============================================================================
// getSmartCartTier — tier boundary tests
// ============================================================================

describe('RuleBasedRecommendationAdapter.getSmartCartTier', () => {
  let adapter: RuleBasedRecommendationAdapter;

  beforeEach(() => {
    adapter = new RuleBasedRecommendationAdapter();
  });

  /**
   * Validates: Requirements 12.1
   * totalOrders: 0 → 'trending' (Tier 1 lower bound)
   */
  it('returns "trending" when totalOrders is 0', async () => {
    ddbMock.on(GetCommand).resolves({ Item: userItem(0) });

    const tier = await adapter.getSmartCartTier('u1');

    expect(tier).toBe('trending');
  });

  /**
   * Validates: Requirements 12.1
   * totalOrders: 4 → 'trending' (Tier 1 upper edge, TIER_1_MAX_ORDERS = 4)
   */
  it('returns "trending" when totalOrders is 4 (Tier-1 upper edge)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: userItem(4) });

    const tier = await adapter.getSmartCartTier('u1');

    expect(tier).toBe('trending');
  });

  /**
   * Validates: Requirements 12.2
   * totalOrders: 5 → 'hybrid' (Tier 2 lower bound)
   */
  it('returns "hybrid" when totalOrders is 5 (Tier-2 start)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: userItem(5) });

    const tier = await adapter.getSmartCartTier('u1');

    expect(tier).toBe('hybrid');
  });

  /**
   * Validates: Requirements 12.2
   * totalOrders: 19 → 'hybrid' (Tier 2 upper edge, TIER_2_MAX_ORDERS = 19)
   */
  it('returns "hybrid" when totalOrders is 19 (Tier-2 upper edge)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: userItem(19) });

    const tier = await adapter.getSmartCartTier('u1');

    expect(tier).toBe('hybrid');
  });

  /**
   * Validates: Requirements 12.3
   * totalOrders: 20 → 'personalize' (Tier 3 lower bound, TIER_3_MIN_ORDERS = 20)
   */
  it('returns "personalize" when totalOrders is 20 (Tier-3 start)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: userItem(20) });

    const tier = await adapter.getSmartCartTier('u1');

    expect(tier).toBe('personalize');
  });

  /**
   * Validates: Requirements 12.3
   * totalOrders: 120 → 'personalize' (power user)
   */
  it('returns "personalize" when totalOrders is 120 (power user)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: userItem(120) });

    const tier = await adapter.getSmartCartTier('u1');

    expect(tier).toBe('personalize');
  });

  /**
   * Validates: Requirements 12.4
   * Item: undefined (user not found) → 'trending', no throw
   */
  it('returns "trending" and does not throw when user is not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    await expect(adapter.getSmartCartTier('unknown-user')).resolves.toBe('trending');
  });

  /**
   * Validates: Requirements 12.4
   * SDK throws → 'trending', no throw (error swallowed gracefully)
   */
  it('returns "trending" and does not throw when DynamoDB SDK throws', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB connection error'));

    await expect(adapter.getSmartCartTier('u1')).resolves.toBe('trending');
  });
});

// ============================================================================
// getRecommendations — inventory filtering (filterInStock via cacheAdapter.mget)
// ============================================================================

describe('RuleBasedRecommendationAdapter.getRecommendations', () => {
  let adapter: RuleBasedRecommendationAdapter;

  beforeEach(() => {
    adapter = new RuleBasedRecommendationAdapter();
  });

  /**
   * Validates: Requirements 12.5, 12.6
   * mget returns all nulls → all products are filtered out → returns []
   */
  it('returns [] when cacheAdapter.mget returns all nulls (no inventory data)', async () => {
    // User is Tier 1 (totalOrders: 0)
    ddbMock.on(GetCommand).resolves({ Item: userItem(0) });
    // ScanCommand returns 3 products for getTier1Recommendations
    ddbMock.on(ScanCommand).resolves(productsResponse(3));
    // Trending cache miss → proceeds to ScanCommand
    mockedCacheAdapter.get.mockResolvedValue(null);
    // Trending cache set resolves OK
    mockedCacheAdapter.set.mockResolvedValue(undefined);
    // Inventory check: all null (products not found in cache)
    mockedCacheAdapter.mget.mockResolvedValue([null, null, null]);

    const result = await adapter.getRecommendations('u1', '110001');

    expect(result).toEqual([]);
  });

  /**
   * Validates: Requirements 12.5, 12.7
   * mget returns all isAvailableFor10Min: false → all filtered out → returns []
   */
  it('returns [] when cacheAdapter.mget returns all isAvailableFor10Min: false', async () => {
    // User is Tier 1 (totalOrders: 0)
    ddbMock.on(GetCommand).resolves({ Item: userItem(0) });
    // ScanCommand returns 2 products
    ddbMock.on(ScanCommand).resolves(productsResponse(2));
    // Trending cache miss
    mockedCacheAdapter.get.mockResolvedValue(null);
    // Trending cache set resolves OK
    mockedCacheAdapter.set.mockResolvedValue(undefined);
    // Inventory check: both out of stock
    mockedCacheAdapter.mget.mockResolvedValue([
      { isAvailableFor10Min: false },
      { isAvailableFor10Min: false },
    ]);

    const result = await adapter.getRecommendations('u1', '110001');

    expect(result).toEqual([]);
  });

  /**
   * Validates: Requirements 12.5, 12.6, 12.7
   * mget returns mixed: first in-stock, rest out — only in-stock returned
   */
  it('returns only in-stock products when mget has mixed inventory states', async () => {
    // User is Tier 1
    ddbMock.on(GetCommand).resolves({ Item: userItem(0) });
    // ScanCommand returns 3 products
    ddbMock.on(ScanCommand).resolves(productsResponse(3));
    // Trending cache miss
    mockedCacheAdapter.get.mockResolvedValue(null);
    mockedCacheAdapter.set.mockResolvedValue(undefined);
    // First product is in-stock; others are not
    mockedCacheAdapter.mget.mockResolvedValue([
      { isAvailableFor10Min: true },
      { isAvailableFor10Min: false },
      null,
    ]);

    const result = await adapter.getRecommendations('u1', '110001');

    expect(result).toHaveLength(1);
    expect(result[0]?.productId).toBe('prod-0');
  });

  /**
   * Validates: Requirements 12.5
   * When trending cache is hit, returns cached recs (then filtered by mget)
   */
  it('uses cached trending recommendations when available and filters by mget', async () => {
    const cachedRecs = [
      {
        productId: 'cached-prod-1',
        name: 'Cached Product',
        brand: 'Brand',
        price: 200,
        imageUrl: 'https://img.example.com/c1.jpg',
        confidence: 0.9,
        reason: 'Popular in your area',
      },
    ];

    // User is Tier 1
    ddbMock.on(GetCommand).resolves({ Item: userItem(0) });
    // Cache hit for trending key
    mockedCacheAdapter.get.mockResolvedValue(cachedRecs);
    // Product is in-stock
    mockedCacheAdapter.mget.mockResolvedValue([{ isAvailableFor10Min: true }]);

    const result = await adapter.getRecommendations('u1', '110001');

    expect(result).toHaveLength(1);
    expect(result[0]?.productId).toBe('cached-prod-1');
    // ScanCommand should NOT have been called (cache was used)
    expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(0);
  });

  /**
   * Validates: Requirements 12.6
   * getRecommendations returns empty array and does not throw when DynamoDB SDK throws
   */
  it('returns [] without throwing when DynamoDB throws during getRecommendations', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    // Ensure cache miss so the code path doesn't return stale cached data
    mockedCacheAdapter.get.mockResolvedValue(null);
    mockedCacheAdapter.set.mockResolvedValue(undefined);
    mockedCacheAdapter.mget.mockResolvedValue([]);

    await expect(adapter.getRecommendations('u1', '110001')).resolves.toEqual([]);
  });

  /**
   * Validates: Requirements 12.1, 12.2
   * Tier 2 hybrid: QueryCommand returns recent orders + trending scan
   */
  it('returns in-stock recommendations for Tier-2 hybrid user', async () => {
    // User is Tier 2 (totalOrders: 10)
    ddbMock.on(GetCommand).resolves({ Item: userItem(10) });
    // QueryCommand for recent orders returns empty
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    // ScanCommand for trending products
    ddbMock.on(ScanCommand).resolves(productsResponse(2));
    // Trending cache miss
    mockedCacheAdapter.get.mockResolvedValue(null);
    mockedCacheAdapter.set.mockResolvedValue(undefined);
    // All in-stock
    mockedCacheAdapter.mget.mockResolvedValue([
      { isAvailableFor10Min: true },
      { isAvailableFor10Min: true },
    ]);

    const result = await adapter.getRecommendations('u1', '110001');

    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
