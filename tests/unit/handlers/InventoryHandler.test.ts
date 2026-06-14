/**
 * Unit tests for Inventory Handlers
 * Routes:
 *   GET  /v1/inventory/{pincode}/{productId}
 *   POST /v1/inventory/batch-check
 */

import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { checkStockHandler, batchCheckHandler } from '@handlers/inventory';
import { AppError, ErrorCodes } from '@constants/errors';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@services/InventoryService', () => ({
  checkStock: jest.fn(),
  batchCheckStock: jest.fn(),
}));

import { checkStock, batchCheckStock } from '@services/InventoryService';

const mockedCheckStock = jest.mocked(checkStock);
const mockedBatchCheckStock = jest.mocked(batchCheckStock);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Helpers
// ============================================================================

const mockContext = {} as Context;
const mockCallback = jest.fn();

function buildGetEvent(
  pincode: string | undefined,
  productId: string | undefined,
  userId = 'user_001'
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /v1/inventory/{pincode}/{productId}',
    rawPath: `/v1/inventory/${pincode}/${productId}`,
    rawQueryString: '',
    headers: { authorization: 'Bearer token123' },
    pathParameters: { pincode, productId } as Record<string, string>,
    requestContext: {
      accountId: '123456789',
      apiId: 'api123',
      domainName: 'api.snap.dev',
      domainPrefix: 'api',
      http: { method: 'GET', path: '/', protocol: 'HTTP/1.1', sourceIp: '1.2.3.4', userAgent: 'jest' },
      requestId: 'req_test_001',
      routeKey: 'GET /v1/inventory/{pincode}/{productId}',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
      authorizer: { jwt: { claims: { sub: userId }, scopes: [] } },
    },
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

function buildPostEvent(body: unknown, userId = 'user_001'): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /v1/inventory/batch-check',
    rawPath: '/v1/inventory/batch-check',
    rawQueryString: '',
    headers: { 'content-type': 'application/json', authorization: 'Bearer token123' },
    body: JSON.stringify(body),
    requestContext: {
      accountId: '123456789',
      apiId: 'api123',
      domainName: 'api.snap.dev',
      domainPrefix: 'api',
      http: { method: 'POST', path: '/', protocol: 'HTTP/1.1', sourceIp: '1.2.3.4', userAgent: 'jest' },
      requestId: 'req_test_002',
      routeKey: 'POST /v1/inventory/batch-check',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
      authorizer: { jwt: { claims: { sub: userId }, scopes: [] } },
    },
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

const inventoryStatus = {
  productId: 'prod_001',
  pincode: '110001',
  isAvailableFor10Min: true,
  stockLevel: 50,
  darkStoreId: 'ds_lajpat_nagar',
};

// ============================================================================
// checkStockHandler — GET /v1/inventory/{pincode}/{productId}
// ============================================================================

describe('checkStockHandler', () => {
  it('valid path — returns 200 with inventory status', async () => {
    mockedCheckStock.mockResolvedValueOnce(inventoryStatus);

    const result = await checkStockHandler(buildGetEvent('110001', 'prod_001'), mockContext, mockCallback);

    expect(result).toBeDefined();
    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(inventoryStatus);
    expect((result as { statusCode: number }).statusCode).toBe(200);
    expect(mockedCheckStock).toHaveBeenCalledWith('110001', 'prod_001');
  });

  it('missing productId — returns 400 bad request', async () => {
    const result = await checkStockHandler(buildGetEvent('110001', undefined), mockContext, mockCallback);

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(false);
    expect((result as { statusCode: number }).statusCode).toBe(400);
    expect(mockedCheckStock).not.toHaveBeenCalled();
  });

  it('invalid pincode (non-6-digit) — returns 400 bad request', async () => {
    const result = await checkStockHandler(buildGetEvent('1100', 'prod_001'), mockContext, mockCallback);

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(false);
    expect((result as { statusCode: number }).statusCode).toBe(400);
  });

  it('service throws OUT_OF_STOCK — returns 422', async () => {
    mockedCheckStock.mockRejectedValueOnce(
      new AppError(ErrorCodes.OUT_OF_STOCK, 'Product out of stock', 422)
    );

    const result = await checkStockHandler(buildGetEvent('110001', 'prod_001'), mockContext, mockCallback);

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('OUT_OF_STOCK');
    expect((result as { statusCode: number }).statusCode).toBe(422);
  });

  it('service throws STOCK_CHECK_FAILED — returns 500', async () => {
    mockedCheckStock.mockRejectedValueOnce(
      new AppError(ErrorCodes.STOCK_CHECK_FAILED, 'DB error', 500, true)
    );

    const result = await checkStockHandler(buildGetEvent('110001', 'prod_001'), mockContext, mockCallback);

    const body = JSON.parse((result as { body: string }).body);
    expect(body.error.code).toBe('STOCK_CHECK_FAILED');
    expect((result as { statusCode: number }).statusCode).toBe(500);
  });

  it('unhandled error — returns 500 internal error', async () => {
    mockedCheckStock.mockRejectedValueOnce(new Error('Unexpected explosion'));

    const result = await checkStockHandler(buildGetEvent('110001', 'prod_001'), mockContext, mockCallback);

    expect((result as { statusCode: number }).statusCode).toBe(500);
  });
});

// ============================================================================
// batchCheckHandler — POST /v1/inventory/batch-check
// ============================================================================

describe('batchCheckHandler', () => {
  it('valid body — returns 200 with results array', async () => {
    const statuses = [inventoryStatus];
    mockedBatchCheckStock.mockResolvedValueOnce(statuses);

    const result = await batchCheckHandler(
      buildPostEvent({ pincode: '110001', productIds: ['prod_001'] }),
      mockContext,
      mockCallback
    );

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(true);
    expect(body.data.results).toEqual(statuses);
    expect(body.data.count).toBe(1);
    expect((result as { statusCode: number }).statusCode).toBe(200);
  });

  it('missing pincode — returns 400', async () => {
    const result = await batchCheckHandler(
      buildPostEvent({ productIds: ['prod_001'] }),
      mockContext,
      mockCallback
    );

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(false);
    expect((result as { statusCode: number }).statusCode).toBe(400);
  });

  it('empty productIds array — returns 400', async () => {
    const result = await batchCheckHandler(
      buildPostEvent({ pincode: '110001', productIds: [] }),
      mockContext,
      mockCallback
    );

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(false);
    expect((result as { statusCode: number }).statusCode).toBe(400);
  });

  it('invalid JSON body — returns 400', async () => {
    const event = buildPostEvent({});
    event.body = '{ invalid json';

    const result = await batchCheckHandler(event, mockContext, mockCallback);

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(false);
    expect((result as { statusCode: number }).statusCode).toBe(400);
  });

  it('invalid pincode format — returns 400', async () => {
    const result = await batchCheckHandler(
      buildPostEvent({ pincode: 'ABCDEF', productIds: ['prod_001'] }),
      mockContext,
      mockCallback
    );

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(false);
    expect((result as { statusCode: number }).statusCode).toBe(400);
  });

  it('service throws AppError — returns correct error code and status', async () => {
    mockedBatchCheckStock.mockRejectedValueOnce(
      new AppError(ErrorCodes.INTERNAL_ERROR, 'Unexpected', 500, true)
    );

    const result = await batchCheckHandler(
      buildPostEvent({ pincode: '110001', productIds: ['prod_001'] }),
      mockContext,
      mockCallback
    );

    const body = JSON.parse((result as { body: string }).body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect((result as { statusCode: number }).statusCode).toBe(500);
  });

  it('batch returns empty array (all out-of-stock) — returns 200 with empty results', async () => {
    mockedBatchCheckStock.mockResolvedValueOnce([]);

    const result = await batchCheckHandler(
      buildPostEvent({ pincode: '110001', productIds: ['prod_oos'] }),
      mockContext,
      mockCallback
    );

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(true);
    expect(body.data.results).toEqual([]);
    expect(body.data.count).toBe(0);
  });
});
