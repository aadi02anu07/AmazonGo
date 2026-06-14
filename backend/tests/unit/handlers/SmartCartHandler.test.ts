/**
 * Unit tests for SmartCart Lambda handlers
 * Covers: getSmartCartHandler, refreshSmartCartHandler
 */

import { APIGatewayProxyEventV2, APIGatewayEventRequestContextV2 } from 'aws-lambda';
import { getSmartCartHandler, refreshSmartCartHandler } from '@handlers/smartCart';
import { AppError, ErrorCodes } from '@constants/errors';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@services/SmartCartService', () => ({
  getSmartCart: jest.fn(),
  refreshSmartCart: jest.fn(),
}));

import { getSmartCart, refreshSmartCart } from '@services/SmartCartService';

const mockedGetSmartCart = jest.mocked(getSmartCart);
const mockedRefreshSmartCart = jest.mocked(refreshSmartCart);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Fixtures
// ============================================================================

const smartCartFixture = {
  userId: 'user_001',
  pincode: '110001',
  tier: 'trending' as const,
  label: 'Popular Near You',
  suggestions: [
    {
      productId: 'prod_amul_milk',
      name: 'Amul Gold Milk 500ml',
      brand: 'Amul',
      price: 3200,
      imageUrl: 'https://cdn.snap.dev/amul-milk.jpg',
      confidence: 0.9,
      reason: 'Popular in your area',
    },
  ],
  generatedAt: '2024-01-01T00:00:00.000Z',
};

// ============================================================================
// Event builders
// ============================================================================

function buildRequestContext(userId?: string): APIGatewayEventRequestContextV2 {
  return {
    accountId: '123456789012',
    apiId: 'api-id',
    domainName: 'api.example.com',
    domainPrefix: 'api',
    http: {
      method: 'GET',
      path: '/v1/smart-cart',
      protocol: 'HTTP/1.1',
      sourceIp: '1.2.3.4',
      userAgent: 'jest',
    },
    requestId: 'req_test_001',
    routeKey: 'GET /v1/smart-cart',
    stage: '$default',
    time: '01/Jan/2024:00:00:00 +0000',
    timeEpoch: 1704067200000,
    ...(userId && {
      authorizer: {
        jwt: {
          claims: { sub: userId },
          scopes: [],
        },
      },
    }),
  } as unknown as APIGatewayEventRequestContextV2;
}

function buildGetEvent(
  queryStringParameters: Record<string, string> | null,
  userId?: string
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /v1/smart-cart',
    rawPath: '/v1/smart-cart',
    rawQueryString: '',
    headers: {},
    requestContext: buildRequestContext(userId),
    isBase64Encoded: false,
    queryStringParameters: queryStringParameters ?? undefined,
  } as unknown as APIGatewayProxyEventV2;
}

function buildPostEvent(body: unknown, userId?: string): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /v1/smart-cart/refresh',
    rawPath: '/v1/smart-cart/refresh',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: buildRequestContext(userId),
    isBase64Encoded: false,
    body: JSON.stringify(body),
  } as unknown as APIGatewayProxyEventV2;
}

// ============================================================================
// getSmartCartHandler
// ============================================================================

describe('getSmartCartHandler', () => {
  it('200: returns SmartCartResult when service succeeds', async () => {
    mockedGetSmartCart.mockResolvedValueOnce(smartCartFixture);

    const event = buildGetEvent({ pincode: '110001' }, 'user_001');
    const result = await getSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 200 });

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(smartCartFixture);
    expect(mockedGetSmartCart).toHaveBeenCalledWith('user_001', '110001');
  });

  it('401: returns UNAUTHORIZED when userId is missing from JWT context', async () => {
    const event = buildGetEvent({ pincode: '110001' }); // no userId
    const result = await getSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 401 });
  });

  it('400: returns bad request when pincode query param is missing', async () => {
    const event = buildGetEvent(null, 'user_001');
    const result = await getSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 400 });
    expect(mockedGetSmartCart).not.toHaveBeenCalled();
  });

  it('400: returns bad request when pincode is not 6 digits', async () => {
    const event = buildGetEvent({ pincode: '11000' }, 'user_001');
    const result = await getSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 400 });
  });

  it('404: forwards USER_NOT_FOUND AppError from service', async () => {
    mockedGetSmartCart.mockRejectedValueOnce(
      new AppError(ErrorCodes.USER_NOT_FOUND, 'User not found', 404)
    );

    const event = buildGetEvent({ pincode: '110001' }, 'user_001');
    const result = await getSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 404 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.error.code).toBe('USER_NOT_FOUND');
  });

  it('422: forwards NO_PRODUCTS_AVAILABLE AppError from service', async () => {
    mockedGetSmartCart.mockRejectedValueOnce(
      new AppError(ErrorCodes.NO_PRODUCTS_AVAILABLE, 'No products available', 422)
    );

    const event = buildGetEvent({ pincode: '110001' }, 'user_001');
    const result = await getSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 422 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.error.code).toBe('NO_PRODUCTS_AVAILABLE');
  });

  it('500: returns internalError for unexpected thrown errors', async () => {
    mockedGetSmartCart.mockRejectedValueOnce(new Error('Unexpected failure'));

    const event = buildGetEvent({ pincode: '110001' }, 'user_001');
    const result = await getSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 500 });
  });
});

// ============================================================================
// refreshSmartCartHandler
// ============================================================================

describe('refreshSmartCartHandler', () => {
  it('200: returns refreshed SmartCartResult when service succeeds', async () => {
    mockedRefreshSmartCart.mockResolvedValueOnce(smartCartFixture);

    const event = buildPostEvent({ pincode: '110001' }, 'user_001');
    const result = await refreshSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 200 });

    const body = JSON.parse((result as { body: string }).body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(smartCartFixture);
    expect(mockedRefreshSmartCart).toHaveBeenCalledWith('user_001', '110001');
  });

  it('401: returns UNAUTHORIZED when userId is missing from JWT context', async () => {
    const event = buildPostEvent({ pincode: '110001' }); // no userId
    const result = await refreshSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 401 });
  });

  it('400: returns bad request when body is missing pincode', async () => {
    const event = buildPostEvent({}, 'user_001');
    const result = await refreshSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 400 });
    expect(mockedRefreshSmartCart).not.toHaveBeenCalled();
  });

  it('400: returns bad request when pincode is invalid (not 6 digits)', async () => {
    const event = buildPostEvent({ pincode: 'abc123' }, 'user_001');
    const result = await refreshSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 400 });
  });

  it('400: returns bad request when body is invalid JSON', async () => {
    const event = {
      ...buildPostEvent({}, 'user_001'),
      body: 'not-json',
    } as unknown as APIGatewayProxyEventV2;
    const result = await refreshSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 400 });
  });

  it('404: forwards USER_NOT_FOUND AppError from service', async () => {
    mockedRefreshSmartCart.mockRejectedValueOnce(
      new AppError(ErrorCodes.USER_NOT_FOUND, 'User not found', 404)
    );

    const event = buildPostEvent({ pincode: '110001' }, 'user_001');
    const result = await refreshSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 404 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.error.code).toBe('USER_NOT_FOUND');
  });

  it('500: returns internalError for unexpected thrown errors', async () => {
    mockedRefreshSmartCart.mockRejectedValueOnce(new Error('Unexpected'));

    const event = buildPostEvent({ pincode: '110001' }, 'user_001');
    const result = await refreshSmartCartHandler(event, {} as never, {} as never);

    expect(result).toMatchObject({ statusCode: 500 });
  });
});
