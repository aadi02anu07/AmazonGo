/**
 * Unit tests for ETAService
 * Tests calculateETA and batchCalculateETA business logic.
 */

import { calculateETA, batchCalculateETA } from '@services/ETAService';
import { AppError } from '@constants/errors';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@clients/dynamoClient', () => ({
  scanItems: jest.fn(),
  TABLE_NAMES: { DARK_STORES: 'Dev-SnapDarkStores' },
  getItem: jest.fn(),
  queryItems: jest.fn(),
  putItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  batchGetItems: jest.fn(),
}));

jest.mock('@adapters/factory', () => ({
  cacheAdapter: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    mget: jest.fn(),
  },
}));

import { scanItems } from '@clients/dynamoClient';
import { cacheAdapter } from '@adapters/factory';

const mockedScanItems = jest.mocked(scanItems);
const mockedCacheGet = jest.mocked(cacheAdapter.get);
const mockedCacheSet = jest.mocked(cacheAdapter.set);

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// Fixtures
// ============================================================================

const storeFast = {
  darkStoreId: 'ds_lajpat_nagar',
  name: 'Lajpat Nagar',
  city: 'Delhi',
  lat: 28.5677,
  lng: 77.2433,
  serviceablePincodes: ['110001', '110024'],
  avgPickupMinutes: 4,
  isOperational: true,
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const storeSlow = {
  darkStoreId: 'ds_connaught_place',
  name: 'Connaught Place',
  city: 'Delhi',
  lat: 28.6315,
  lng: 77.2167,
  serviceablePincodes: ['110001'],
  avgPickupMinutes: 10,
  isOperational: true,
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const storeOffline = {
  ...storeFast,
  darkStoreId: 'ds_offline',
  isOperational: false,
};

// ============================================================================
// calculateETA
// ============================================================================

describe('calculateETA', () => {
  it('cache hit: returns cached ETAResult without querying DynamoDB', async () => {
    const cachedETA = {
      etaMinutes: 12,
      etaAt: '2024-01-01T00:12:00.000Z',
      darkStoreId: 'ds_lajpat_nagar',
      label: 'Delivery in 12 minutes',
    };
    mockedCacheGet.mockResolvedValueOnce(cachedETA);

    const result = await calculateETA('110001');

    expect(result).toEqual(cachedETA);
    expect(mockedScanItems).not.toHaveBeenCalled();
    expect(mockedCacheGet).toHaveBeenCalledWith('eta:110001');
  });

  it('cache miss + serviceable pincode: returns ETAResult with correct etaMinutes and label', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedScanItems.mockResolvedValueOnce([storeFast]);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await calculateETA('110001');

    // avgPickupMinutes (4) + DEFAULT_LAST_MILE_MINUTES (8) = 12
    expect(result.etaMinutes).toBe(12);
    expect(result.darkStoreId).toBe('ds_lajpat_nagar');
    expect(result.label).toBe('Delivery in 12 minutes');
    expect(result.etaAt).toBeTruthy();
    expect(mockedCacheSet).toHaveBeenCalledWith('eta:110001', result, 60);
  });

  it('cache miss + non-serviceable pincode: throws PINCODE_NOT_SERVICEABLE (422)', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedScanItems.mockResolvedValueOnce([]);

    const error = await calculateETA('999999').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'PINCODE_NOT_SERVICEABLE',
      statusCode: 422,
    });
  });

  it('offline store only: throws DARKSTORE_OFFLINE (503)', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedScanItems.mockResolvedValueOnce([storeOffline]);

    const error = await calculateETA('110001').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'DARKSTORE_OFFLINE',
      statusCode: 503,
      retryable: true,
    });
  });

  it('multiple stores: selects store with minimum avgPickupMinutes', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    // storeSlow (10 min) listed first; storeFast (4 min) should win
    mockedScanItems.mockResolvedValueOnce([storeSlow, storeFast]);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await calculateETA('110001');

    expect(result.darkStoreId).toBe('ds_lajpat_nagar');
    expect(result.etaMinutes).toBe(12); // 4 + 8
  });

  it('etaAt is a valid ISO 8601 string approximately now + etaMinutes', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedScanItems.mockResolvedValueOnce([storeFast]);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const before = Date.now();
    const result = await calculateETA('110001');
    const after = Date.now();

    const etaTimestamp = new Date(result.etaAt).getTime();
    expect(etaTimestamp).toBeGreaterThan(before + 11 * 60_000);
    expect(etaTimestamp).toBeLessThan(after + 13 * 60_000);
  });

  it('mix of online and offline stores: skips offline, returns ETA from operational store', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedScanItems.mockResolvedValueOnce([storeOffline, storeSlow]);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await calculateETA('110001');

    expect(result.darkStoreId).toBe('ds_connaught_place');
    expect(result.etaMinutes).toBe(18); // 10 + 8
  });

  it('cache.get throws: swallows error and continues to DynamoDB', async () => {
    mockedCacheGet.mockRejectedValueOnce(new Error('Redis unavailable'));
    mockedScanItems.mockResolvedValueOnce([storeFast]);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await calculateETA('110001');

    expect(result.etaMinutes).toBe(12);
  });

  it('cache.set throws: swallows error and still returns result', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedScanItems.mockResolvedValueOnce([storeFast]);
    mockedCacheSet.mockRejectedValueOnce(new Error('Redis write error'));

    const result = await calculateETA('110001');

    expect(result.etaMinutes).toBe(12);
  });
});

// ============================================================================
// batchCalculateETA
// ============================================================================

describe('batchCalculateETA', () => {
  it('all pincodes serviceable: returns ETAResult for each pincode', async () => {
    mockedCacheGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockedScanItems
      .mockResolvedValueOnce([storeFast])  // 110001 → 4+8 = 12
      .mockResolvedValueOnce([storeSlow]); // 110024 → 10+8 = 18
    mockedCacheSet.mockResolvedValue(undefined);

    const results = await batchCalculateETA(['110001', '110024']);

    expect(results).toHaveLength(2);
    expect(results[0]?.etaMinutes).toBe(12);
    expect(results[1]?.etaMinutes).toBe(18);
  });

  it('mixed results: swallows individual errors and returns only successful ETAResults', async () => {
    mockedCacheGet
      .mockResolvedValueOnce(null) // 110001: cache miss
      .mockResolvedValueOnce(null); // 999999: cache miss
    mockedScanItems
      .mockResolvedValueOnce([storeFast]) // 110001 → OK
      .mockResolvedValueOnce([]);          // 999999 → no stores → PINCODE_NOT_SERVICEABLE
    mockedCacheSet.mockResolvedValue(undefined);

    const results = await batchCalculateETA(['110001', '999999']);

    expect(results).toHaveLength(1);
    expect(results[0]?.darkStoreId).toBe('ds_lajpat_nagar');
  });

  it('all pincodes fail: returns empty array', async () => {
    mockedCacheGet.mockResolvedValue(null);
    mockedScanItems.mockResolvedValue([]);

    const results = await batchCalculateETA(['999998', '999999']);

    expect(results).toHaveLength(0);
  });

  it('empty pincodes array: returns empty array', async () => {
    const results = await batchCalculateETA([]);
    expect(results).toHaveLength(0);
    expect(mockedScanItems).not.toHaveBeenCalled();
  });
});
