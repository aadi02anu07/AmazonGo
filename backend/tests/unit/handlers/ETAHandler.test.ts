/**
 * Unit tests for ETA Lambda Handlers
 * Routes: GET /v1/eta, POST /v1/eta/batch
 */

import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { calculateETAHandler, batchETAHandler } from '@handlers/eta';
import { AppError, ErrorCodes } from '@constants/errors';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@services/ETAService', () => ({
  calculateETA: jest.fn(),
  batchCalculateETA: jest.fn(),
}));

import { calculateETA, batchCalculateETA } from '@services/ETAService';

const mockedCalculateETA = jest.mocked(calculateETA);
const mockedBatchCalculateETA = jest.mocked(batchCalculateETA);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Fixtures / Helpers
// ============================================================================

const etaResult = {
  etaMinutes: 12,
  etaAt: '2024-01-01T00:12:00.000Z',
  darkStoreId: 'ds_lajpat_nagar',
  label: 'Delivery in 12 minutes',
};

/** Minimal context stub */
const fakeContext = {} as Context;
const fakeCallback = jest.fn();

/**
 * Build a minimal APIGatewayProxyEventV2 for GET requests with query params.
 */
function buildGetEvent(
  queryStringParameters: Record<string, string> = {}
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /v1/eta',
    rawPath: '/v1/eta',
    rawQueryString: new URLSearchParams(queryStringParameters).toString(),
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: '/v1/eta',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'jest-test',
      },
      requestId: 'req_test_001',
      routeKey: 'GET /v1/eta',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
    isBase64Encoded: false,
    queryStringParameters,
  } as unknown as APIGatewayProxyEventV2;
}

/**
 * Build a minimal APIGatewayProxyEventV2 for POST requests with a JSON body.
 */
function buildPostEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /v1/eta/batch',
    rawPath: '/v1/eta/batch',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: '/v1/eta/batch',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'jest-test',
      },
      requestId: 'req_test_002',
      routeKey: 'POST /v1/eta/batch',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
    isBase64Encoded: false,
    body: JSON.stringify(body),
  } as unknown as APIGatewayProxyEventV2;
}

// ============================================================================
// calculateETAHandler  (GET /v1/eta?pincode=...)
// ============================================================================

describe('calculateETAHandler', () => {
  it('200: valid pincode returns ETAResult', async () => {
    mockedCalculateETA.mockResolvedValueOnce(etaResult);

    const result = await calculateETAHandler(
      buildGetEvent({ pincode: '110001' }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(etaResult);
    expect(mockedCalculateETA).toHaveBeenCalledWith('110001');
  });

  it('400: missing pincode returns bad request', async () => {
    const result = await calculateETAHandler(
      buildGetEvent({}),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body as string);
    expect(body.success).toBe(false);
  });

  it('400: pincode with wrong length returns bad request', async () => {
    const result = await calculateETAHandler(
      buildGetEvent({ pincode: '123' }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(400);
  });

  it('400: pincode with letters returns bad request', async () => {
    const result = await calculateETAHandler(
      buildGetEvent({ pincode: 'abcdef' }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(400);
  });

  it('422: PINCODE_NOT_SERVICEABLE error is propagated', async () => {
    mockedCalculateETA.mockRejectedValueOnce(
      new AppError(ErrorCodes.PINCODE_NOT_SERVICEABLE, 'Pincode not serviceable', 422)
    );

    const result = await calculateETAHandler(
      buildGetEvent({ pincode: '999999' }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(422);
    const body = JSON.parse(result.body as string);
    expect(body.error.code).toBe('PINCODE_NOT_SERVICEABLE');
  });

  it('503: DARKSTORE_OFFLINE error is propagated', async () => {
    mockedCalculateETA.mockRejectedValueOnce(
      new AppError(ErrorCodes.DARKSTORE_OFFLINE, 'All dark stores offline', 503, true)
    );

    const result = await calculateETAHandler(
      buildGetEvent({ pincode: '110001' }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(503);
    const body = JSON.parse(result.body as string);
    expect(body.error.code).toBe('DARKSTORE_OFFLINE');
    expect(body.error.retryable).toBe(true);
  });

  it('500: unhandled error returns internal server error', async () => {
    mockedCalculateETA.mockRejectedValueOnce(new Error('Unexpected error'));

    const result = await calculateETAHandler(
      buildGetEvent({ pincode: '110001' }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(500);
  });
});

// ============================================================================
// batchETAHandler  (POST /v1/eta/batch)
// ============================================================================

describe('batchETAHandler', () => {
  it('200: valid pincodes array returns results array', async () => {
    const batchResults = [etaResult, { ...etaResult, etaMinutes: 18, label: 'Delivery in 18 minutes' }];
    mockedBatchCalculateETA.mockResolvedValueOnce(batchResults);

    const result = await batchETAHandler(
      buildPostEvent({ pincodes: ['110001', '110024'] }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.success).toBe(true);
    expect(body.data.results).toHaveLength(2);
    expect(body.data.count).toBe(2);
    expect(mockedBatchCalculateETA).toHaveBeenCalledWith(['110001', '110024']);
  });

  it('200: partial results (some pincodes failed) returns successful ones', async () => {
    mockedBatchCalculateETA.mockResolvedValueOnce([etaResult]);

    const result = await batchETAHandler(
      buildPostEvent({ pincodes: ['110001', '999999'] }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.data.count).toBe(1);
  });

  it('400: missing pincodes field returns bad request', async () => {
    const result = await batchETAHandler(
      buildPostEvent({}),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(400);
  });

  it('400: pincodes is not an array returns bad request', async () => {
    const result = await batchETAHandler(
      buildPostEvent({ pincodes: '110001' }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(400);
  });

  it('400: pincodes array contains invalid pincode (not 6 digits)', async () => {
    const result = await batchETAHandler(
      buildPostEvent({ pincodes: ['110001', 'abc'] }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(400);
  });

  it('400: invalid JSON body returns bad request', async () => {
    const event = buildPostEvent({});
    // Override body with malformed JSON (cast through unknown for strict TS)
    (event as unknown as Record<string, unknown>)['body'] = '{invalid json';

    const result = await batchETAHandler(event, fakeContext, fakeCallback);

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(400);
  });

  it('500: unhandled error in batchCalculateETA returns internal server error', async () => {
    mockedBatchCalculateETA.mockRejectedValueOnce(new Error('Unexpected'));

    const result = await batchETAHandler(
      buildPostEvent({ pincodes: ['110001'] }),
      fakeContext,
      fakeCallback
    );

    expect(result).toBeDefined();
    if (!result || typeof result !== 'object') return;
    expect(result.statusCode).toBe(500);
  });
});
