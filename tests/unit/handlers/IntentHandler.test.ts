/**
 * Unit tests for Intent handlers
 * Mocks the service layer — no live DynamoDB / adapter required.
 *
 * Handlers under test:
 *   resolveTextIntentHandler  POST /v1/intent/text
 *   resolveVoiceIntentHandler POST /v1/intent/voice
 */

// Must mock before imports that reference the module
jest.mock('@services/IntentService');

import { resolveTextIntentHandler, resolveVoiceIntentHandler } from '@handlers/intent';
import { resolveTextIntent, resolveVoiceIntent } from '@services/IntentService';
import { AppError, ErrorCodes } from '@constants/errors';
import type { IntentResult } from '@models/Intent';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// ============================================================================
// Typed mocks
// ============================================================================

const mockedResolveTextIntent = jest.mocked(resolveTextIntent);
const mockedResolveVoiceIntent = jest.mocked(resolveVoiceIntent);

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// Helpers
// ============================================================================

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /test',
    rawPath: '/test',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: '123',
      apiId: 'test',
      domainName: 'test.execute-api.ap-south-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: '/test',
        protocol: 'HTTP/1.1',
        sourceIp: '1.2.3.4',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: 'POST /test',
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

const highConfidenceResult: IntentResult = {
  productId: 'prod_amul_milk_500',
  name: 'Amul Gold Milk 500ml',
  brand: 'Amul',
  price: 3200,
  imageUrl: 'https://cdn.snap.dev/products/amul-milk-500.jpg',
  confidence: 0.9,
  reason: 'Matched query: "amul milk"',
  resolvedBy: 'text',
  alternatives: [],
};

const validBody = JSON.stringify({ transcript: 'amul milk', pincode: '110001' });

// ============================================================================
// resolveTextIntentHandler
// ============================================================================

describe('resolveTextIntentHandler', () => {
  it('200 — returns intent result when service resolves', async () => {
    mockedResolveTextIntent.mockResolvedValueOnce(highConfidenceResult);

    const event = makeEvent({ body: validBody });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
    const data = body.data as IntentResult;
    expect(data.productId).toBe(highConfidenceResult.productId);
    expect(data.confidence).toBe(highConfidenceResult.confidence);
    expect(mockedResolveTextIntent).toHaveBeenCalledWith('amul milk', '110001', 'test_user_001');
  });

  it('400 — returns EMPTY_TRANSCRIPT error when service throws it', async () => {
    mockedResolveTextIntent.mockRejectedValueOnce(
      new AppError(ErrorCodes.EMPTY_TRANSCRIPT, 'Transcript must not be empty', 400)
    );

    const event = makeEvent({ body: validBody });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    const body = parseBody(result);
    expect(body.success).toBe(false);
    expect((body.error as { code: string }).code).toBe(ErrorCodes.EMPTY_TRANSCRIPT);
  });

  it('500 — returns INTENT_RESOLUTION_FAILED error when service throws it', async () => {
    mockedResolveTextIntent.mockRejectedValueOnce(
      new AppError(ErrorCodes.INTENT_RESOLUTION_FAILED, 'Failed to resolve text intent', 500, true)
    );

    const event = makeEvent({ body: validBody });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(500);
    const body = parseBody(result);
    expect(body.success).toBe(false);
    expect((body.error as { code: string }).code).toBe(ErrorCodes.INTENT_RESOLUTION_FAILED);
  });

  it('400 — invalid pincode (5 digits)', async () => {
    const event = makeEvent({
      body: JSON.stringify({ transcript: 'amul milk', pincode: '11000' }),
    });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveTextIntent).not.toHaveBeenCalled();
  });

  it('400 — missing transcript field', async () => {
    const event = makeEvent({
      body: JSON.stringify({ pincode: '110001' }),
    });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveTextIntent).not.toHaveBeenCalled();
  });

  it('400 — empty string transcript fails Zod min(1)', async () => {
    const event = makeEvent({
      body: JSON.stringify({ transcript: '', pincode: '110001' }),
    });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveTextIntent).not.toHaveBeenCalled();
  });

  it('400 — transcript exceeds 1000 characters', async () => {
    const event = makeEvent({
      body: JSON.stringify({ transcript: 'a'.repeat(1001), pincode: '110001' }),
    });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveTextIntent).not.toHaveBeenCalled();
  });

  it('400 — missing pincode field', async () => {
    const event = makeEvent({
      body: JSON.stringify({ transcript: 'amul milk' }),
    });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveTextIntent).not.toHaveBeenCalled();
  });

  it('400 — missing / null body', async () => {
    const event = makeEvent({ body: undefined });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveTextIntent).not.toHaveBeenCalled();
  });

  it('401 — missing JWT sub claim', async () => {
    const event = makeEvent({
      body: validBody,
      requestContext: {
        accountId: '123',
        apiId: 'test',
        domainName: 'test.execute-api.ap-south-1.amazonaws.com',
        domainPrefix: 'test',
        http: {
          method: 'POST',
          path: '/test',
          protocol: 'HTTP/1.1',
          sourceIp: '1.2.3.4',
          userAgent: 'test',
        },
        requestId: 'test-request-id',
        routeKey: 'POST /test',
        stage: '$default',
        time: '01/Jan/2024:00:00:00 +0000',
        timeEpoch: 1704067200,
        // No authorizer
      } as APIGatewayProxyEventV2['requestContext'],
    });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(401);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveTextIntent).not.toHaveBeenCalled();
  });

  it('500 — unhandled error returns 500', async () => {
    mockedResolveTextIntent.mockRejectedValueOnce(new Error('Unexpected failure'));

    const event = makeEvent({ body: validBody });
    const result = await resolveTextIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(500);
    expect(parseBody(result).success).toBe(false);
  });
});

// ============================================================================
// resolveVoiceIntentHandler
// ============================================================================

describe('resolveVoiceIntentHandler', () => {
  it('200 — returns intent result when service resolves', async () => {
    mockedResolveVoiceIntent.mockResolvedValueOnce(highConfidenceResult);

    const event = makeEvent({ body: validBody });
    const result = await resolveVoiceIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
    const data = body.data as IntentResult;
    expect(data.productId).toBe(highConfidenceResult.productId);
    expect(mockedResolveVoiceIntent).toHaveBeenCalledWith('amul milk', '110001', 'test_user_001');
  });

  it('400 — returns EMPTY_TRANSCRIPT error when service throws it', async () => {
    mockedResolveVoiceIntent.mockRejectedValueOnce(
      new AppError(ErrorCodes.EMPTY_TRANSCRIPT, 'Transcript must not be empty', 400)
    );

    const event = makeEvent({ body: validBody });
    const result = await resolveVoiceIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect((parseBody(result).error as { code: string }).code).toBe(ErrorCodes.EMPTY_TRANSCRIPT);
  });

  it('500 — returns INTENT_RESOLUTION_FAILED error when service throws it', async () => {
    mockedResolveVoiceIntent.mockRejectedValueOnce(
      new AppError(ErrorCodes.INTENT_RESOLUTION_FAILED, 'Failed to resolve voice intent', 500, true)
    );

    const event = makeEvent({ body: validBody });
    const result = await resolveVoiceIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(500);
    expect((parseBody(result).error as { code: string }).code).toBe(ErrorCodes.INTENT_RESOLUTION_FAILED);
  });

  it('400 — invalid pincode (non-numeric)', async () => {
    const event = makeEvent({
      body: JSON.stringify({ transcript: 'amul milk', pincode: 'ABCDEF' }),
    });
    const result = await resolveVoiceIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveVoiceIntent).not.toHaveBeenCalled();
  });

  it('400 — missing transcript field', async () => {
    const event = makeEvent({
      body: JSON.stringify({ pincode: '110001' }),
    });
    const result = await resolveVoiceIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveVoiceIntent).not.toHaveBeenCalled();
  });

  it('400 — transcript exceeds 1000 characters', async () => {
    const event = makeEvent({
      body: JSON.stringify({ transcript: 'a'.repeat(1001), pincode: '110001' }),
    });
    const result = await resolveVoiceIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveVoiceIntent).not.toHaveBeenCalled();
  });

  it('400 — missing / null body', async () => {
    const event = makeEvent({ body: undefined });
    const result = await resolveVoiceIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(400);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveVoiceIntent).not.toHaveBeenCalled();
  });

  it('401 — missing JWT sub claim', async () => {
    const event = makeEvent({
      body: validBody,
      requestContext: {
        accountId: '123',
        apiId: 'test',
        domainName: 'test.execute-api.ap-south-1.amazonaws.com',
        domainPrefix: 'test',
        http: {
          method: 'POST',
          path: '/test',
          protocol: 'HTTP/1.1',
          sourceIp: '1.2.3.4',
          userAgent: 'test',
        },
        requestId: 'test-request-id',
        routeKey: 'POST /test',
        stage: '$default',
        time: '01/Jan/2024:00:00:00 +0000',
        timeEpoch: 1704067200,
        // No authorizer
      } as APIGatewayProxyEventV2['requestContext'],
    });
    const result = await resolveVoiceIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(401);
    expect(parseBody(result).success).toBe(false);
    expect(mockedResolveVoiceIntent).not.toHaveBeenCalled();
  });

  it('500 — unhandled error returns 500', async () => {
    mockedResolveVoiceIntent.mockRejectedValueOnce(new Error('Unexpected failure'));

    const event = makeEvent({ body: validBody });
    const result = await resolveVoiceIntentHandler(event, {} as never, {} as never);

    expect(statusCode(result)).toBe(500);
    expect(parseBody(result).success).toBe(false);
  });
});
