/**
 * Unit tests for InventoryService
 */

import {
  checkStock,
  batchCheckStock,
  softReserve,
  releaseReservation,
} from '@services/InventoryService';
import { AppError } from '@constants/errors';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@clients/dynamoClient', () => ({
  getItem: jest.fn(),
  updateItem: jest.fn(),
  TABLE_NAMES: { INVENTORY: 'Dev-SnapInventory' },
}));

jest.mock('@adapters/factory', () => ({
  cacheAdapter: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    mget: jest.fn(),
  },
}));

import { getItem, updateItem } from '@clients/dynamoClient';
import { cacheAdapter } from '@adapters/factory';

const mockedGetItem = jest.mocked(getItem);
const mockedUpdateItem = jest.mocked(updateItem);
const mockedCacheGet = jest.mocked(cacheAdapter.get);
const mockedCacheSet = jest.mocked(cacheAdapter.set);
const mockedCacheDel = jest.mocked(cacheAdapter.del);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Fixtures
// ============================================================================

const inventoryRecord = {
  pincodeProductId: '110001#prod_001',
  pincode: '110001',
  productId: 'prod_001',
  darkStoreId: 'ds_lajpat_nagar',
  stockLevel: 50,
  isAvailableFor10Min: true,
  reservedUnits: 0,
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const inventoryStatus = {
  productId: 'prod_001',
  pincode: '110001',
  isAvailableFor10Min: true,
  stockLevel: 50,
  darkStoreId: 'ds_lajpat_nagar',
};

// ============================================================================
// checkStock
// ============================================================================

describe('checkStock', () => {
  it('cache hit — returns cached status without DB call', async () => {
    mockedCacheGet.mockResolvedValueOnce(inventoryStatus);

    const result = await checkStock('110001', 'prod_001');

    expect(result).toEqual(inventoryStatus);
    expect(mockedGetItem).not.toHaveBeenCalled();
    expect(mockedCacheGet).toHaveBeenCalledWith('inv:110001:prod_001');
  });

  it('cache miss + available product — fetches from DynamoDB and caches result', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetItem.mockResolvedValueOnce(inventoryRecord);
    mockedCacheSet.mockResolvedValueOnce(undefined);

    const result = await checkStock('110001', 'prod_001');

    expect(result).toEqual(inventoryStatus);
    expect(mockedGetItem).toHaveBeenCalledWith('Dev-SnapInventory', {
      pincodeProductId: '110001#prod_001',
    });
    expect(mockedCacheSet).toHaveBeenCalledWith('inv:110001:prod_001', inventoryStatus, 30);
  });

  it('cache miss + unavailable product — throws OUT_OF_STOCK (422)', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetItem.mockResolvedValueOnce({
      ...inventoryRecord,
      isAvailableFor10Min: false,
    });

    const error = await checkStock('110001', 'prod_001').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'OUT_OF_STOCK', statusCode: 422 });
  });

  it('DB error — throws STOCK_CHECK_FAILED (500)', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetItem.mockRejectedValueOnce(new Error('DynamoDB timeout'));

    const error = await checkStock('110001', 'prod_001').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'STOCK_CHECK_FAILED', statusCode: 500 });
  });

  it('product not found in DB — throws OUT_OF_STOCK (422)', async () => {
    mockedCacheGet.mockResolvedValueOnce(null);
    mockedGetItem.mockResolvedValueOnce(null);

    const error = await checkStock('110001', 'prod_001').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'OUT_OF_STOCK', statusCode: 422 });
  });
});

// ============================================================================
// batchCheckStock
// ============================================================================

describe('batchCheckStock', () => {
  it('returns available products and silently drops errored ones', async () => {
    const availableRecord = { ...inventoryRecord, productId: 'prod_001', pincodeProductId: '110001#prod_001' };
    const unavailableRecord = { ...inventoryRecord, productId: 'prod_002', pincodeProductId: '110001#prod_002', isAvailableFor10Min: false };

    mockedCacheGet
      .mockResolvedValueOnce(null)       // prod_001 cache miss
      .mockResolvedValueOnce(null);      // prod_002 cache miss
    mockedGetItem
      .mockResolvedValueOnce(availableRecord)
      .mockResolvedValueOnce(unavailableRecord);
    mockedCacheSet.mockResolvedValue(undefined);

    const results = await batchCheckStock('110001', ['prod_001', 'prod_002']);

    // prod_002 is OUT_OF_STOCK so it gets dropped by the error handler
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ productId: 'prod_001' });
  });

  it('all items available — returns full array', async () => {
    const rec2 = { ...inventoryRecord, productId: 'prod_002', pincodeProductId: '110001#prod_002' };
    mockedCacheGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockedGetItem
      .mockResolvedValueOnce(inventoryRecord)
      .mockResolvedValueOnce(rec2);
    mockedCacheSet.mockResolvedValue(undefined);

    const results = await batchCheckStock('110001', ['prod_001', 'prod_002']);

    expect(results).toHaveLength(2);
  });

  it('all items error — returns empty array without throwing', async () => {
    mockedCacheGet.mockResolvedValue(null);
    mockedGetItem.mockRejectedValue(new Error('DB error'));

    const results = await batchCheckStock('110001', ['prod_001', 'prod_002']);

    expect(results).toEqual([]);
  });
});

// ============================================================================
// softReserve
// ============================================================================

describe('softReserve', () => {
  it('success — calls updateItem with condition and invalidates cache', async () => {
    mockedUpdateItem.mockResolvedValueOnce(undefined);
    mockedCacheDel.mockResolvedValueOnce(undefined);

    await softReserve('110001', 'prod_001', 'user_001', 2);

    expect(mockedUpdateItem).toHaveBeenCalledWith(
      'Dev-SnapInventory',
      { pincodeProductId: '110001#prod_001' },
      expect.stringContaining('reservedUnits'),
      expect.objectContaining({ ':qty': 2 }),
      undefined,
      expect.stringContaining('stockLevel')
    );
    expect(mockedCacheDel).toHaveBeenCalledWith('inv:110001:prod_001');
  });

  it('invalid quantity (0) — throws INVALID_QUANTITY (400)', async () => {
    const error = await softReserve('110001', 'prod_001', 'user_001', 0).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'INVALID_QUANTITY', statusCode: 400 });
    expect(mockedUpdateItem).not.toHaveBeenCalled();
  });

  it('invalid quantity (100) — throws INVALID_QUANTITY (400)', async () => {
    const error = await softReserve('110001', 'prod_001', 'user_001', 100).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'INVALID_QUANTITY', statusCode: 400 });
  });

  it('ConditionalCheckFailedException — throws RESERVATION_FAILED (422)', async () => {
    const conditionalError = new Error('ConditionalCheckFailedException');
    conditionalError.name = 'ConditionalCheckFailedException';
    mockedUpdateItem.mockRejectedValueOnce(conditionalError);

    const error = await softReserve('110001', 'prod_001', 'user_001', 1).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'RESERVATION_FAILED', statusCode: 422 });
  });
});

// ============================================================================
// releaseReservation
// ============================================================================

describe('releaseReservation', () => {
  it('success — decrements reservedUnits and invalidates cache', async () => {
    mockedUpdateItem.mockResolvedValueOnce(undefined);
    mockedCacheDel.mockResolvedValueOnce(undefined);

    await releaseReservation('110001', 'prod_001', 1);

    expect(mockedUpdateItem).toHaveBeenCalledWith(
      'Dev-SnapInventory',
      { pincodeProductId: '110001#prod_001' },
      expect.stringContaining('reservedUnits'),
      expect.objectContaining({ ':qty': 1 })
    );
    expect(mockedCacheDel).toHaveBeenCalledWith('inv:110001:prod_001');
  });

  it('DB error — propagates error without swallowing', async () => {
    mockedUpdateItem.mockRejectedValueOnce(new AppError('DATABASE_ERROR', 'DB error', 500, true));

    const error = await releaseReservation('110001', 'prod_001', 1).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(mockedCacheDel).not.toHaveBeenCalled();
  });
});
