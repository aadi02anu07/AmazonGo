/**
 * Unit tests for IntentService
 *
 * Validates: Requirements 9.1–9.6 (Intent Resolution)
 */

import { resolveTextIntent, resolveVoiceIntent } from '@services/IntentService';
import { AppError } from '@constants/errors';
import type { IntentResult } from '@models/Intent';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@adapters/factory', () => ({
  intentAdapter: {
    resolveIntent: jest.fn(),
  },
}));

import { intentAdapter } from '@adapters/factory';

const mockedResolveIntent = jest.mocked(intentAdapter.resolveIntent);

beforeEach(() => jest.clearAllMocks());

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

const mediumConfidenceResult: IntentResult = {
  productId: 'prod_amul_milk_500',
  name: 'Amul Gold Milk 500ml',
  brand: 'Amul',
  price: 3200,
  imageUrl: 'https://cdn.snap.dev/products/amul-milk-500.jpg',
  confidence: 0.62,
  reason: 'Possible match for: "milk"',
  resolvedBy: 'text',
  alternatives: [
    {
      productId: 'prod_britannia_bread',
      name: 'Britannia Bread',
      brand: 'Britannia',
      price: 4500,
      imageUrl: 'https://cdn.snap.dev/products/britannia-bread.jpg',
    },
  ],
};

const lowConfidenceResult: IntentResult = {
  productId: '',
  name: '',
  brand: '',
  price: 0,
  imageUrl: '',
  confidence: 0.2,
  reason: 'Low confidence match',
  resolvedBy: 'none',
  suggestedInput: 'xyz',
};

// ============================================================================
// resolveTextIntent
// ============================================================================

describe('resolveTextIntent', () => {
  it('Req 9.1 — success: returns adapter result for valid transcript', async () => {
    mockedResolveIntent.mockResolvedValueOnce(highConfidenceResult);

    const result = await resolveTextIntent('amul milk', '110001', 'user-1');

    expect(result).toEqual(highConfidenceResult);
    expect(mockedResolveIntent).toHaveBeenCalledWith('amul milk', '110001', 'user-1');
  });

  it('Req 9.2 — empty transcript: throws AppError EMPTY_TRANSCRIPT (400)', async () => {
    const error = await resolveTextIntent('', '110001', 'user-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'EMPTY_TRANSCRIPT', statusCode: 400 });
    expect(mockedResolveIntent).not.toHaveBeenCalled();
  });

  it('Req 9.3 — whitespace-only transcript: throws AppError EMPTY_TRANSCRIPT (400)', async () => {
    const error = await resolveTextIntent('   ', '110001', 'user-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'EMPTY_TRANSCRIPT', statusCode: 400 });
    expect(mockedResolveIntent).not.toHaveBeenCalled();
  });

  it('Req 9.4 — adapter throws generic error: rethrows as INTENT_RESOLUTION_FAILED (500)', async () => {
    mockedResolveIntent.mockRejectedValueOnce(new Error('DynamoDB error'));

    const error = await resolveTextIntent('amul milk', '110001', 'user-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'INTENT_RESOLUTION_FAILED', statusCode: 500 });
  });

  it('Req 9.5 — adapter throws AppError: rethrows the same AppError unchanged', async () => {
    const originalError = new AppError('SOME_ERROR', 'Something specific', 422);
    mockedResolveIntent.mockRejectedValueOnce(originalError);

    const error = await resolveTextIntent('amul milk', '110001', 'user-1').catch((e: unknown) => e);

    expect(error).toBe(originalError);
    expect(error).toMatchObject({ code: 'SOME_ERROR', statusCode: 422 });
  });

  it('Req 9.6 — trims transcript before calling adapter', async () => {
    mockedResolveIntent.mockResolvedValueOnce(highConfidenceResult);

    await resolveTextIntent('  amul milk  ', '110001', 'user-1');

    expect(mockedResolveIntent).toHaveBeenCalledWith('amul milk', '110001', 'user-1');
  });

  it('confidence ≥ 0.75: adapter returns alternatives: []', async () => {
    mockedResolveIntent.mockResolvedValueOnce(highConfidenceResult);

    const result = await resolveTextIntent('amul milk', '110001', 'user-1');

    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.alternatives).toEqual([]);
  });

  it('confidence 0.50–0.74: adapter returns alternatives with 1–2 entries', async () => {
    mockedResolveIntent.mockResolvedValueOnce(mediumConfidenceResult);

    const result = await resolveTextIntent('milk', '110001', 'user-1');

    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.alternatives).toBeDefined();
    expect(result.alternatives!.length).toBeGreaterThanOrEqual(1);
    expect(result.alternatives!.length).toBeLessThanOrEqual(2);
  });

  it('confidence < 0.50: adapter returns resolvedBy "none"', async () => {
    mockedResolveIntent.mockResolvedValueOnce(lowConfidenceResult);

    const result = await resolveTextIntent('xyz', '110001', 'user-1');

    expect(result.confidence).toBeLessThan(0.5);
    expect(result.resolvedBy).toBe('none');
  });
});

// ============================================================================
// resolveVoiceIntent
// ============================================================================

describe('resolveVoiceIntent', () => {
  it('Req 9.1 — success: returns adapter result for valid transcript', async () => {
    mockedResolveIntent.mockResolvedValueOnce(highConfidenceResult);

    const result = await resolveVoiceIntent('amul milk', '110001', 'user-1');

    expect(result).toEqual(highConfidenceResult);
    expect(mockedResolveIntent).toHaveBeenCalledWith('amul milk', '110001', 'user-1');
  });

  it('Req 9.2 — empty transcript: throws AppError EMPTY_TRANSCRIPT (400)', async () => {
    const error = await resolveVoiceIntent('', '110001', 'user-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'EMPTY_TRANSCRIPT', statusCode: 400 });
    expect(mockedResolveIntent).not.toHaveBeenCalled();
  });

  it('Req 9.3 — whitespace-only transcript: throws AppError EMPTY_TRANSCRIPT (400)', async () => {
    const error = await resolveVoiceIntent('   ', '110001', 'user-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'EMPTY_TRANSCRIPT', statusCode: 400 });
    expect(mockedResolveIntent).not.toHaveBeenCalled();
  });

  it('Req 9.4 — adapter throws generic error: rethrows as INTENT_RESOLUTION_FAILED (500)', async () => {
    mockedResolveIntent.mockRejectedValueOnce(new Error('DynamoDB error'));

    const error = await resolveVoiceIntent('amul milk', '110001', 'user-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'INTENT_RESOLUTION_FAILED', statusCode: 500 });
  });

  it('Req 9.5 — adapter throws AppError: rethrows the same AppError unchanged', async () => {
    const originalError = new AppError('SOME_ERROR', 'Something specific', 422);
    mockedResolveIntent.mockRejectedValueOnce(originalError);

    const error = await resolveVoiceIntent('amul milk', '110001', 'user-1').catch((e: unknown) => e);

    expect(error).toBe(originalError);
  });

  it('Req 9.6 — trims transcript before calling adapter', async () => {
    mockedResolveIntent.mockResolvedValueOnce(highConfidenceResult);

    await resolveVoiceIntent('  amul milk  ', '110001', 'user-1');

    expect(mockedResolveIntent).toHaveBeenCalledWith('amul milk', '110001', 'user-1');
  });

  it('confidence ≥ 0.75: adapter returns alternatives: []', async () => {
    mockedResolveIntent.mockResolvedValueOnce(highConfidenceResult);

    const result = await resolveVoiceIntent('amul milk', '110001', 'user-1');

    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.alternatives).toEqual([]);
  });

  it('confidence 0.50–0.74: adapter returns alternatives with 1–2 entries', async () => {
    mockedResolveIntent.mockResolvedValueOnce(mediumConfidenceResult);

    const result = await resolveVoiceIntent('milk', '110001', 'user-1');

    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.alternatives!.length).toBeGreaterThanOrEqual(1);
    expect(result.alternatives!.length).toBeLessThanOrEqual(2);
  });

  it('confidence < 0.50: adapter returns resolvedBy "none"', async () => {
    mockedResolveIntent.mockResolvedValueOnce(lowConfidenceResult);

    const result = await resolveVoiceIntent('xyz', '110001', 'user-1');

    expect(result.resolvedBy).toBe('none');
  });
});
