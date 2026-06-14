/**
 * Integration-style handler tests for Products handlers
 * Mocks the service layer — no live DynamoDB required.
 *
 * Handlers under test:
 *   getProduct, searchProductsHandler, getTrendingHandler, getBarcodeHandler
 */

// Must mock before imports that reference the module
jest.mock('@services/ProductService');

import { getProduct, searchProductsHandler, getTrendingHandler, getBarcodeHandler } from '@handlers/products';
import {
  getProductById,
  searchProducts,
  getTrendingProducts,
  getProductByBarcode,
} from '@services/ProductService';
import { AppError, ErrorCodes } from '@constants/errors';
import { buildProduct } from '../../fixtures';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// ============================================================================
// Typed mocks
// ============================================================================

const mockedGetProductById = jest.mocked(getProductById);
const mockedSearchProducts = jest.mocked(searchProducts);
const mockedGetTrendingProducts = jest.mocked(getTrendingProducts);
const mockedGetProductByBarcode = jest.mocked(getProductByBarcode);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Helpers
// ============================================================================

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /test',
    rawPath: '/test',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123',
      apiId: 'test',
      domainName: 'test.execute-api.ap-south-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: '/test',
        protocol: 'HTTP/1.1',
        sourceIp: '1.2.3.4',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: 'GET /test',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200,
      authorizer: {
        jwt: { claims: { sub: 'test_user_001' }, scopes: [] },
      },
    } as APIGatewayProxyEventV2['requestContext'],
    isBase64Encoded: false,
    ...overrides,
  };
}

function parseBody(result: unknown): Record<string, unknown> {
  const r = result as { statusCode: number; body: string };
  return JSON.parse(r.body) as Record<string, unknown>;
}

function statusCode(result: unknown): number {
  return (result as { statusCode: number }).statusCode;
}

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
// getProduct handler
// ============================================================================

describe('getProduct', () => {
  it('200 — returns product when service resolves', async () => {
    mockedGetProductById.mockResolvedValueOnce(product);

    const event = makeEvent({ pathParameters: { productId: product.productId } });
    const result = await getProduct(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
    expect((body.data as typeof product).productId).toBe(product.productId);
  });

  it('404 — returns error when service throws PRODUCT_NOT_FOUND', async () => {
    mockedGetProductById.mockRejectedValueOnce(
      new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found', 404)
    );

    const event = makeEvent({ pathParameters: { productId: 'nonexistent' } });
    const result = await getProduct(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(404);
    const body = parseBody(result);
    expect(body.success).toBe(false);
    expect((body.error as { code: string }).code).toBe(ErrorCodes.PRODUCT_NOT_FOUND);
  });

  it('400 — returns bad request when productId is missing', async () => {
    const event = makeEvent({ pathParameters: {} });
    const result = await getProduct(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    const body = parseBody(result);
    expect(body.success).toBe(false);
  });
});

// ============================================================================
// searchProductsHandler
// ============================================================================

describe('searchProductsHandler', () => {
  it('200 — returns results when service resolves', async () => {
    mockedSearchProducts.mockResolvedValueOnce(searchResults as never);

    const event = makeEvent({
      queryStringParameters: { q: 'milk', pincode: '110001' },
    });
    const result = await searchProductsHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
    const data = body.data as { results: unknown[]; count: number };
    expect(data.count).toBe(1);
    expect(data.results).toHaveLength(1);
  });

  it('400 — invalid pincode (5 digits)', async () => {
    const event = makeEvent({
      queryStringParameters: { q: 'milk', pincode: '11000' },
    });
    const result = await searchProductsHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
  });

  it('400 — missing q parameter', async () => {
    const event = makeEvent({
      queryStringParameters: { pincode: '110001' },
    });
    const result = await searchProductsHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
  });

  it('400 — q exceeds 200 characters', async () => {
    const longQuery = 'a'.repeat(201);
    const event = makeEvent({
      queryStringParameters: { q: longQuery, pincode: '110001' },
    });
    const result = await searchProductsHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
  });
});

// ============================================================================
// getTrendingHandler
// ============================================================================

describe('getTrendingHandler', () => {
  it('200 — returns trending products when service resolves', async () => {
    mockedGetTrendingProducts.mockResolvedValueOnce(searchResults as never);

    const event = makeEvent({
      queryStringParameters: { pincode: '110001' },
    });
    const result = await getTrendingHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
    const data = body.data as { products: unknown[]; count: number };
    expect(data.count).toBe(1);
  });

  it('400 — invalid pincode (non-numeric)', async () => {
    const event = makeEvent({
      queryStringParameters: { pincode: 'ABCDEF' },
    });
    const result = await getTrendingHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
  });

  it('400 — missing pincode', async () => {
    const event = makeEvent({ queryStringParameters: {} });
    const result = await getTrendingHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
  });
});

// ============================================================================
// getBarcodeHandler
// ============================================================================

describe('getBarcodeHandler', () => {
  it('200 — returns product when barcode is found', async () => {
    mockedGetProductByBarcode.mockResolvedValueOnce(product);

    const event = makeEvent({ pathParameters: { code: '1234567890123' } });
    const result = await getBarcodeHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
    expect((body.data as typeof product).productId).toBe(product.productId);
  });

  it('404 — returns BARCODE_NOT_FOUND when service throws it', async () => {
    mockedGetProductByBarcode.mockRejectedValueOnce(
      new AppError(ErrorCodes.BARCODE_NOT_FOUND, 'Barcode not found', 404)
    );

    const event = makeEvent({ pathParameters: { code: '0000000000000' } });
    const result = await getBarcodeHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(404);
    const body = parseBody(result);
    expect(body.success).toBe(false);
    expect((body.error as { code: string }).code).toBe(ErrorCodes.BARCODE_NOT_FOUND);
  });

  it('400 — returns bad request when code is missing', async () => {
    const event = makeEvent({ pathParameters: {} });
    const result = await getBarcodeHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
  });
});
