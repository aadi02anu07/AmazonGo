/**
 * Unit tests for OrdersService
 */

import {
  placeOrder,
  getOrder,
  getOrderHistory,
  getRecentOrders,
  reorder,
  generateOrderId,
} from '@services/OrdersService';
import { AppError } from '@constants/errors';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@clients/dynamoClient', () => ({
  getItem: jest.fn(),
  putItem: jest.fn(),
  updateItem: jest.fn(),
  queryItems: jest.fn(),
  TABLE_NAMES: {
    PRODUCTS: 'Dev-SnapProducts',
    ORDERS: 'Dev-SnapOrders',
    USERS: 'Dev-SnapUsers',
  },
}));

jest.mock('@adapters/factory', () => ({
  cacheAdapter: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    mget: jest.fn(),
  },
}));

import { getItem, putItem, updateItem, queryItems } from '@clients/dynamoClient';
import { cacheAdapter } from '@adapters/factory';

const mockedGetItem = jest.mocked(getItem);
const mockedPutItem = jest.mocked(putItem);
const mockedUpdateItem = jest.mocked(updateItem);
const mockedQueryItems = jest.mocked(queryItems);
const mockedCacheDel = jest.mocked(cacheAdapter.del);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Fixtures
// ============================================================================

const productFixture = {
  productId: 'prod_test_001',
  sku: 'SKU-TEST-001',
  name: 'Test Product',
  brand: 'Test Brand',
  category: 'grocery',
  subCategory: 'dairy',
  description: 'A test product',
  imageUrls: ['https://cdn.snap.dev/test.jpg'],
  price: 5000,
  mrp: 6000,
  unit: '500ml',
  tags: ['test'],
  weight: '500g',
  barcodes: ['1234567890123'],
  rekognitionLabels: ['Food'],
  isAvailable: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const orderRequestFixture = {
  items: [{ productId: 'prod_test_001', quantity: 2 }],
  pincode: '110001',
  addressId: 'addr_001',
  paymentMethod: 'amazon_pay',
};

const orderFixture = {
  orderId: 'ord_1704067200000_abc123',
  userId: 'user_001',
  status: 'PLACED' as const,
  items: [
    {
      productId: 'prod_test_001',
      name: 'Test Product',
      brand: 'Test Brand',
      quantity: 2,
      priceAtOrder: 5000,
      imageUrl: 'https://cdn.snap.dev/test.jpg',
    },
  ],
  subtotal: 10000,
  deliveryFee: 0,
  total: 10000,
  pincode: '110001',
  addressId: 'addr_001',
  darkStoreId: 'ds_lajpat_nagar',
  etaMinutes: 12,
  etaAt: '2024-01-01T00:15:00.000Z',
  paymentMethod: 'amazon_pay',
  paymentStatus: 'COMPLETED',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// ============================================================================
// generateOrderId
// ============================================================================

describe('generateOrderId', () => {
  it('returns a string matching the ord_{timestamp}_{uuid6} format', () => {
    const id = generateOrderId();
    expect(id).toMatch(/^ord_\d+_[a-z0-9]{6}$/);
  });

  it('generates unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateOrderId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

// ============================================================================
// placeOrder
// ============================================================================

describe('placeOrder', () => {
  it('success: returns an Order with correct orderId format, calculated totals, and COMPLETED paymentStatus', async () => {
    mockedQueryItems.mockResolvedValueOnce({ items: [productFixture], nextCursor: undefined });
    mockedPutItem.mockResolvedValueOnce(undefined);
    mockedUpdateItem.mockResolvedValueOnce(undefined);
    mockedCacheDel.mockResolvedValueOnce(undefined);

    const order = await placeOrder('user_001', orderRequestFixture);

    expect(order.orderId).toMatch(/^ord_\d+_[a-z0-9]{6}$/);
    expect(order.userId).toBe('user_001');
    expect(order.status).toBe('PLACED');
    expect(order.subtotal).toBe(10000); // 5000 * 2
    expect(order.deliveryFee).toBe(0);
    expect(order.total).toBe(10000);
    expect(order.paymentStatus).toBe('COMPLETED');
    expect(order.etaMinutes).toBe(12);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.priceAtOrder).toBe(5000);
  });

  it('empty items: throws AppError EMPTY_CART (400)', async () => {
    const error = await placeOrder('user_001', { ...orderRequestFixture, items: [] }).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'EMPTY_CART', statusCode: 400 });
    expect(mockedGetItem).not.toHaveBeenCalled();
  });

  it('product not found: throws AppError PRODUCT_NOT_FOUND (404)', async () => {
    mockedQueryItems.mockResolvedValueOnce({ items: [], nextCursor: undefined });

    const error = await placeOrder('user_001', orderRequestFixture).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'PRODUCT_NOT_FOUND', statusCode: 404 });
  });

  it('duplicate orderId: throws AppError DUPLICATE_ORDER (409) when putItem throws ConditionalCheckFailedException', async () => {
    mockedQueryItems.mockResolvedValueOnce({ items: [productFixture], nextCursor: undefined });

    const conditionalError = Object.assign(new Error('The conditional request failed'), {
      name: 'ConditionalCheckFailedException',
    });
    mockedPutItem.mockRejectedValueOnce(conditionalError);

    const error = await placeOrder('user_001', orderRequestFixture).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'DUPLICATE_ORDER', statusCode: 409 });
  });

  it('invalidates smart cart cache with key smartcart:{userId}', async () => {
    mockedQueryItems.mockResolvedValueOnce({ items: [productFixture], nextCursor: undefined });
    mockedPutItem.mockResolvedValueOnce(undefined);
    mockedUpdateItem.mockResolvedValueOnce(undefined);
    mockedCacheDel.mockResolvedValueOnce(undefined);

    await placeOrder('user_001', orderRequestFixture);

    expect(mockedCacheDel).toHaveBeenCalledWith('smartcart:user_001');
  });

  it('cache invalidation failure does not throw — order is still returned', async () => {
    mockedQueryItems.mockResolvedValueOnce({ items: [productFixture], nextCursor: undefined });
    mockedPutItem.mockResolvedValueOnce(undefined);
    mockedUpdateItem.mockResolvedValueOnce(undefined);
    mockedCacheDel.mockRejectedValueOnce(new Error('Cache unavailable'));

    const order = await placeOrder('user_001', orderRequestFixture);

    expect(order.orderId).toMatch(/^ord_\d+_[a-z0-9]{6}$/);
  });

  it('uses default paymentMethod amazon_pay when not provided', async () => {
    mockedQueryItems.mockResolvedValueOnce({ items: [productFixture], nextCursor: undefined });
    mockedPutItem.mockResolvedValueOnce(undefined);
    mockedUpdateItem.mockResolvedValueOnce(undefined);
    mockedCacheDel.mockResolvedValueOnce(undefined);

    const { paymentMethod: _pm, ...requestWithoutMethod } = orderRequestFixture;
    const order = await placeOrder('user_001', requestWithoutMethod);

    expect(order.paymentMethod).toBe('amazon_pay');
  });
});

// ============================================================================
// getOrder
// ============================================================================

describe('getOrder', () => {
  it('found + same userId: returns the order', async () => {
    mockedGetItem.mockResolvedValueOnce(orderFixture);

    const order = await getOrder('ord_1704067200000_abc123', 'user_001');

    expect(order).toEqual(orderFixture);
    expect(mockedGetItem).toHaveBeenCalledWith('Dev-SnapOrders', {
      userId: 'user_001',
      orderId: 'ord_1704067200000_abc123',
    });
  });

  it('not found: throws AppError ORDER_NOT_FOUND (404) when getItem returns null', async () => {
    mockedGetItem.mockResolvedValueOnce(null);

    const error = await getOrder('nonexistent', 'user_001').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
  });

  it('found but different userId: throws AppError ORDER_NOT_FOUND (404) — never 403', async () => {
    mockedGetItem.mockResolvedValueOnce(orderFixture); // belongs to user_001

    const error = await getOrder('ord_1704067200000_abc123', 'other_user').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
  });
});

// ============================================================================
// getOrderHistory
// ============================================================================

describe('getOrderHistory', () => {
  it('returns paginated results with orders and nextCursor', async () => {
    const nextCursorEncoded = Buffer.from(JSON.stringify({ orderId: 'ord_x', userId: 'user_001' })).toString('base64');
    mockedQueryItems.mockResolvedValueOnce({
      items: [orderFixture],
      nextCursor: nextCursorEncoded,
    });

    const result = await getOrderHistory('user_001', 10);

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toEqual(orderFixture);
    expect(result.nextCursor).toBe(nextCursorEncoded);
    expect(mockedQueryItems).toHaveBeenCalledWith(
      expect.objectContaining({
        keyConditionExpression: 'userId = :userId',
        expressionAttributeValues: { ':userId': 'user_001' },
        scanIndexForward: false,
      })
    );
  });

  it('passes decoded cursor as exclusiveStartKey', async () => {
    const startKey = { orderId: 'ord_prev', userId: 'user_001' };
    const cursor = Buffer.from(JSON.stringify(startKey)).toString('base64');

    mockedQueryItems.mockResolvedValueOnce({ items: [], nextCursor: undefined });

    await getOrderHistory('user_001', 10, cursor);

    expect(mockedQueryItems).toHaveBeenCalledWith(
      expect.objectContaining({ exclusiveStartKey: startKey })
    );
  });

  it('returns empty orders and no nextCursor at end of list', async () => {
    mockedQueryItems.mockResolvedValueOnce({ items: [], nextCursor: undefined });

    const result = await getOrderHistory('user_001');

    expect(result.orders).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });
});

// ============================================================================
// getRecentOrders
// ============================================================================

describe('getRecentOrders', () => {
  it('returns up to 5 most recent orders', async () => {
    mockedQueryItems.mockResolvedValueOnce({ items: [orderFixture], nextCursor: undefined });

    const orders = await getRecentOrders('user_001');

    expect(orders).toEqual([orderFixture]);
    expect(mockedQueryItems).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 })
    );
  });

  it('returns empty array when no orders exist', async () => {
    mockedQueryItems.mockResolvedValueOnce({ items: [], nextCursor: undefined });

    const orders = await getRecentOrders('user_001');

    expect(orders).toEqual([]);
  });
});

// ============================================================================
// reorder
// ============================================================================

describe('reorder', () => {
  it('success: creates a new order from an existing order, returning a new orderId', async () => {
    // First getItem call: fetches original order
    mockedGetItem.mockResolvedValueOnce(orderFixture);
    // queryItems call: fetches product details for re-order (queryItems used for composite key)
    mockedQueryItems.mockResolvedValueOnce({ items: [productFixture], nextCursor: undefined });
    mockedPutItem.mockResolvedValueOnce(undefined);
    mockedUpdateItem.mockResolvedValueOnce(undefined);
    mockedCacheDel.mockResolvedValueOnce(undefined);

    const newOrder = await reorder('ord_1704067200000_abc123', 'user_001');

    expect(newOrder.orderId).toMatch(/^ord_\d+_[a-z0-9]{6}$/);
    expect(newOrder.orderId).not.toBe('ord_1704067200000_abc123');
    expect(newOrder.pincode).toBe(orderFixture.pincode);
    expect(newOrder.addressId).toBe(orderFixture.addressId);
    expect(newOrder.items[0]?.productId).toBe('prod_test_001');
  });

  it('original order not found: throws AppError ORDER_NOT_FOUND', async () => {
    mockedGetItem.mockResolvedValueOnce(null);

    const error = await reorder('nonexistent', 'user_001').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
  });
});
