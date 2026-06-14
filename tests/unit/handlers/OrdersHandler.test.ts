/**
 * Unit tests for Orders Lambda Handlers
 */

import {
  placeOrderHandler,
  getOrderHistoryHandler,
  getRecentOrdersHandler,
  getOrderHandler,
  reorderHandler,
} from '@handlers/orders';
import { AppError, ErrorCodes } from '@constants/errors';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@services/OrdersService', () => ({
  placeOrder: jest.fn(),
  getOrder: jest.fn(),
  getOrderHistory: jest.fn(),
  getRecentOrders: jest.fn(),
  reorder: jest.fn(),
}));

import {
  placeOrder,
  getOrder,
  getOrderHistory,
  getRecentOrders,
  reorder,
} from '@services/OrdersService';

const mockedPlaceOrder = jest.mocked(placeOrder);
const mockedGetOrder = jest.mocked(getOrder);
const mockedGetOrderHistory = jest.mocked(getOrderHistory);
const mockedGetRecentOrders = jest.mocked(getRecentOrders);
const mockedReorder = jest.mocked(reorder);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Fixtures & helpers
// ============================================================================

const TEST_USER_ID = 'user_test_001';

const orderFixture = {
  orderId: 'ord_1704067200000_abc123',
  userId: TEST_USER_ID,
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

/** Build a minimal APIGatewayProxyEventV2 with JWT claims */
function buildEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /v1/orders',
    rawPath: '/v1/orders',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      domainName: 'test.execute-api.ap-south-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: '/v1/orders',
        protocol: 'HTTP/1.1',
        sourceIp: '1.2.3.4',
        userAgent: 'test-agent',
      },
      requestId: 'req_test_001',
      routeKey: 'POST /v1/orders',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
      authorizer: {
        jwt: {
          claims: { sub: TEST_USER_ID },
          scopes: [],
        },
      },
    } as APIGatewayProxyEventV2['requestContext'],
    isBase64Encoded: false,
    body: undefined,
    pathParameters: undefined,
    queryStringParameters: undefined,
    stageVariables: undefined,
    ...overrides,
  };
}

/** Build event with no JWT claims (unauthenticated) */
function buildUnauthEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  const event = buildEvent(overrides);
  // Cast through unknown to bypass strict type overlap check
  (event.requestContext as unknown as Record<string, unknown>)['authorizer'] = undefined;
  return event;
}

// ============================================================================
// POST /v1/orders — placeOrderHandler
// ============================================================================

describe('placeOrderHandler', () => {
  const validBody = JSON.stringify({
    items: [{ productId: 'prod_test_001', quantity: 2 }],
    pincode: '110001',
    addressId: 'addr_001',
    paymentMethod: 'amazon_pay',
  });

  it('201 + order on success', async () => {
    mockedPlaceOrder.mockResolvedValueOnce(orderFixture);

    const result = await placeOrderHandler(buildEvent({ body: validBody }), {} as never, {} as never);
    const body = JSON.parse((result as { body: string }).body);

    expect((result as { statusCode: number }).statusCode).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.orderId).toBe(orderFixture.orderId);
  });

  it('401 when no userId in token', async () => {
    const result = await placeOrderHandler(buildUnauthEvent({ body: validBody }), {} as never, {} as never);

    expect((result as { statusCode: number }).statusCode).toBe(401);
  });

  it('400 when body is not valid JSON', async () => {
    const result = await placeOrderHandler(buildEvent({ body: '{bad json' }), {} as never, {} as never);

    expect((result as { statusCode: number }).statusCode).toBe(400);
  });

  it('400 when items array is empty', async () => {
    const body = JSON.stringify({ items: [], pincode: '110001', addressId: 'addr_001' });
    const result = await placeOrderHandler(buildEvent({ body }), {} as never, {} as never);

    expect((result as { statusCode: number }).statusCode).toBe(400);
  });

  it('400 when pincode is invalid', async () => {
    const body = JSON.stringify({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '1100',
      addressId: 'addr_001',
    });
    const result = await placeOrderHandler(buildEvent({ body }), {} as never, {} as never);

    expect((result as { statusCode: number }).statusCode).toBe(400);
  });

  it('propagates AppError from service (e.g. EMPTY_CART)', async () => {
    mockedPlaceOrder.mockRejectedValueOnce(
      new AppError(ErrorCodes.EMPTY_CART, 'Cart is empty', 400)
    );

    const result = await placeOrderHandler(buildEvent({ body: validBody }), {} as never, {} as never);
    const body = JSON.parse((result as { body: string }).body);

    expect((result as { statusCode: number }).statusCode).toBe(400);
    expect(body.error.code).toBe('EMPTY_CART');
  });

  it('500 on unexpected error', async () => {
    mockedPlaceOrder.mockRejectedValueOnce(new Error('Something exploded'));

    const result = await placeOrderHandler(buildEvent({ body: validBody }), {} as never, {} as never);

    expect((result as { statusCode: number }).statusCode).toBe(500);
  });
});

// ============================================================================
// GET /v1/orders — getOrderHistoryHandler
// ============================================================================

describe('getOrderHistoryHandler', () => {
  it('200 + paginated result on success', async () => {
    mockedGetOrderHistory.mockResolvedValueOnce({
      orders: [orderFixture],
      nextCursor: 'cursor_abc',
    });

    const result = await getOrderHistoryHandler(buildEvent(), {} as never, {} as never);
    const body = JSON.parse((result as { body: string }).body);

    expect((result as { statusCode: number }).statusCode).toBe(200);
    expect(body.data.orders).toHaveLength(1);
    expect(body.data.nextCursor).toBe('cursor_abc');
  });

  it('passes cursor and limit query params to service', async () => {
    mockedGetOrderHistory.mockResolvedValueOnce({ orders: [], nextCursor: undefined });

    const cursor = Buffer.from(JSON.stringify({ orderId: 'x' })).toString('base64');
    const event = buildEvent({ queryStringParameters: { cursor, limit: '5' } });
    await getOrderHistoryHandler(event, {} as never, {} as never);

    expect(mockedGetOrderHistory).toHaveBeenCalledWith(TEST_USER_ID, 5, cursor);
  });

  it('401 when no userId in token', async () => {
    const result = await getOrderHistoryHandler(buildUnauthEvent(), {} as never, {} as never);

    expect((result as { statusCode: number }).statusCode).toBe(401);
  });

  it('400 when limit is out of range', async () => {
    const result = await getOrderHistoryHandler(
      buildEvent({ queryStringParameters: { limit: '999' } }),
      {} as never,
      {} as never
    );

    expect((result as { statusCode: number }).statusCode).toBe(400);
  });
});

// ============================================================================
// GET /v1/orders/recent — getRecentOrdersHandler
// ============================================================================

describe('getRecentOrdersHandler', () => {
  it('200 + orders + count on success', async () => {
    mockedGetRecentOrders.mockResolvedValueOnce([orderFixture]);

    const result = await getRecentOrdersHandler(buildEvent(), {} as never, {} as never);
    const body = JSON.parse((result as { body: string }).body);

    expect((result as { statusCode: number }).statusCode).toBe(200);
    expect(body.data.orders).toHaveLength(1);
    expect(body.data.count).toBe(1);
  });

  it('401 when no userId in token', async () => {
    const result = await getRecentOrdersHandler(buildUnauthEvent(), {} as never, {} as never);

    expect((result as { statusCode: number }).statusCode).toBe(401);
  });

  it('propagates AppError from service', async () => {
    mockedGetRecentOrders.mockRejectedValueOnce(
      new AppError(ErrorCodes.DATABASE_ERROR, 'DynamoDB error', 500, true)
    );

    const result = await getRecentOrdersHandler(buildEvent(), {} as never, {} as never);

    expect((result as { statusCode: number }).statusCode).toBe(500);
  });
});

// ============================================================================
// GET /v1/orders/{orderId} — getOrderHandler
// ============================================================================

describe('getOrderHandler', () => {
  it('200 + order on success', async () => {
    mockedGetOrder.mockResolvedValueOnce(orderFixture);

    const event = buildEvent({ pathParameters: { orderId: 'ord_1704067200000_abc123' } });
    const result = await getOrderHandler(event, {} as never, {} as never);
    const body = JSON.parse((result as { body: string }).body);

    expect((result as { statusCode: number }).statusCode).toBe(200);
    expect(body.data.orderId).toBe('ord_1704067200000_abc123');
  });

  it('401 when no userId in token', async () => {
    const result = await getOrderHandler(
      buildUnauthEvent({ pathParameters: { orderId: 'ord_x' } }),
      {} as never,
      {} as never
    );

    expect((result as { statusCode: number }).statusCode).toBe(401);
  });

  it('400 when orderId path param is missing', async () => {
    const result = await getOrderHandler(
      buildEvent({ pathParameters: {} }),
      {} as never,
      {} as never
    );

    expect((result as { statusCode: number }).statusCode).toBe(400);
  });

  it('404 when ORDER_NOT_FOUND AppError is thrown', async () => {
    mockedGetOrder.mockRejectedValueOnce(
      new AppError(ErrorCodes.ORDER_NOT_FOUND, 'Order not found', 404)
    );

    const result = await getOrderHandler(
      buildEvent({ pathParameters: { orderId: 'ord_nonexistent' } }),
      {} as never,
      {} as never
    );
    const body = JSON.parse((result as { body: string }).body);

    expect((result as { statusCode: number }).statusCode).toBe(404);
    expect(body.error.code).toBe('ORDER_NOT_FOUND');
  });
});

// ============================================================================
// POST /v1/orders/{orderId}/reorder — reorderHandler
// ============================================================================

describe('reorderHandler', () => {
  it('201 + new order on success', async () => {
    const newOrder = { ...orderFixture, orderId: 'ord_9999999999999_zzzzzz' };
    mockedReorder.mockResolvedValueOnce(newOrder);

    const event = buildEvent({ pathParameters: { orderId: 'ord_1704067200000_abc123' } });
    const result = await reorderHandler(event, {} as never, {} as never);
    const body = JSON.parse((result as { body: string }).body);

    expect((result as { statusCode: number }).statusCode).toBe(201);
    expect(body.data.orderId).toBe('ord_9999999999999_zzzzzz');
    expect(mockedReorder).toHaveBeenCalledWith('ord_1704067200000_abc123', TEST_USER_ID);
  });

  it('401 when no userId in token', async () => {
    const result = await reorderHandler(
      buildUnauthEvent({ pathParameters: { orderId: 'ord_x' } }),
      {} as never,
      {} as never
    );

    expect((result as { statusCode: number }).statusCode).toBe(401);
  });

  it('400 when orderId path param is missing', async () => {
    const result = await reorderHandler(
      buildEvent({ pathParameters: {} }),
      {} as never,
      {} as never
    );

    expect((result as { statusCode: number }).statusCode).toBe(400);
  });

  it('404 when original order not found', async () => {
    mockedReorder.mockRejectedValueOnce(
      new AppError(ErrorCodes.ORDER_NOT_FOUND, 'Order not found', 404)
    );

    const result = await reorderHandler(
      buildEvent({ pathParameters: { orderId: 'ord_nonexistent' } }),
      {} as never,
      {} as never
    );

    expect((result as { statusCode: number }).statusCode).toBe(404);
  });

  it('500 on unexpected error', async () => {
    mockedReorder.mockRejectedValueOnce(new Error('Unexpected failure'));

    const result = await reorderHandler(
      buildEvent({ pathParameters: { orderId: 'ord_x' } }),
      {} as never,
      {} as never
    );

    expect((result as { statusCode: number }).statusCode).toBe(500);
  });
});
