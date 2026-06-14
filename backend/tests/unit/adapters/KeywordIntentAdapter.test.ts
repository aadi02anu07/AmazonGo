/**
 * Unit tests for KeywordIntentAdapter
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 *
 * Uses aws-sdk-client-mock to intercept DynamoDB ScanCommand calls.
 * The adapter is instantiated once per describe block; the mock is reset
 * between tests via afterEach().
 */

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { KeywordIntentAdapter } from '../../../src/adapters/intent/KeywordIntentAdapter';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
});

// ---------------------------------------------------------------------------
// Product fixtures
// ---------------------------------------------------------------------------

/**
 * Fixture products used across all tests.
 *
 * p1 – "Amul Gold Milk":  brand="Amul", tags include "amul" so that a query of
 *       "amul milk" hits name(3)+brand(2)+tag(2) = 7 pts per "amul" token,
 *       achieving confidence ≥ 0.75 for the high-confidence scenario.
 * p2 – "Britannia Bread":  partially matches grocery queries.
 * p3 – "Lay's Classic Chips":  snacks category product.
 */
const PRODUCTS = [
  {
    productId: 'p1',
    name: 'Amul Gold Milk',
    brand: 'Amul',
    category: 'grocery',
    subCategory: 'dairy',
    price: 3200,
    mrp: 3500,
    unit: '500ml',
    imageUrls: ['https://example.com/amul-milk.jpg'],
    // "amul" is in tags so a query of "amul" scores name+brand+tag = 7/8
    tags: ['milk', 'dairy', 'amul'],
    isAvailable: true,
    sku: 'SKU-001',
  },
  {
    productId: 'p2',
    name: 'Britannia Bread',
    brand: 'Britannia',
    category: 'grocery',
    subCategory: 'bread',
    price: 4500,
    mrp: 5000,
    unit: '400g',
    imageUrls: ['https://example.com/britannia-bread.jpg'],
    tags: ['bread', 'wheat'],
    isAvailable: true,
    sku: 'SKU-002',
  },
  {
    productId: 'p3',
    name: "Lay's Classic Chips",
    brand: 'Lays',
    category: 'snacks',
    subCategory: 'chips',
    price: 2000,
    mrp: 2000,
    unit: '26g',
    imageUrls: ['https://example.com/lays-chips.jpg'],
    tags: ['chips', 'snack'],
    isAvailable: true,
    sku: 'SKU-003',
  },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Returns a fresh adapter instance (constructor triggers DynamoDB client init) */
function makeAdapter(): KeywordIntentAdapter {
  return new KeywordIntentAdapter();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KeywordIntentAdapter.resolveIntent', () => {
  // -------------------------------------------------------------------------
  // Scenario 1 – High confidence (≥ 0.75)
  // Query: "amul milk"
  //   tokens: ["amul", "milk"]
  //   p1 "amul" scores: name(3) + brand(2) + tag(2)   = 7 / 8
  //   p1 "milk" scores: name(3) + tag(2)               = 5 / 8
  //   p1 total: 12 / 16  → confidence = 0.75  ← exactly at the threshold
  //   p2 / p3 score 0 for both tokens → filtered out
  //   Expects resolvedBy: 'text', alternatives: []
  // -------------------------------------------------------------------------
  it('returns high-confidence single match (≥ 0.75) for "amul milk"', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: PRODUCTS });

    const adapter = makeAdapter();
    const result = await adapter.resolveIntent('amul milk', '110001', 'user-1');

    expect(result.productId).toBe('p1');
    expect(result.name).toBe('Amul Gold Milk');
    expect(result.resolvedBy).toBe('text');
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    // High confidence → alternatives must be an empty array
    expect(result.alternatives).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Scenario 2 – Medium confidence (0.50 ≤ confidence < 0.75) with alternatives
  // Query: "grocery bread"
  //   tokens: ["grocery", "bread"]
  //   p1 "grocery": category match(1)           = 1 / 8
  //   p1 "bread":   name? no, brand? no, tag? no, category? no = 0 / 8
  //   p1 total: 1 / 16 → 0.0625 (low, filtered out below 0.50)
  //
  //   p2 "grocery": category(1)                 = 1 / 8
  //   p2 "bread":   name(3)+tag(2)+category? no = 5 / 8
  //   p2 total: 6 / 16 → 0.375 (also < 0.50 — need a better query)
  //
  // Better approach: query "milk bread" — two distinct product tokens
  //   tokens: ["milk", "bread"]
  //   p1 "milk": name(3)+tag(2)=5; "bread": 0       → 5/16 = 0.3125
  //   p2 "milk": 0; "bread": name(3)+tag(2)=5        → 5/16 = 0.3125
  //
  // Even better: query "amul bread" to split loyalty
  //   tokens: ["amul", "bread"]  maxScore per product = 16
  //   p1 "amul": name(3)+brand(2)+tag(2)=7; "bread":0  → 7/16=0.4375
  //   p2 "amul":0; "bread": name(3)+tag(2)=5           → 5/16=0.3125
  //   Neither qualifies as medium (both < 0.50).
  //
  // Reassessment: with these 3 products, hitting medium requires a token that
  // matches one product across name+brand+tags (≥5 pts) out of maxScore 8 for
  // that token (62.5%) — which does not reach 0.75 but IS ≥ 0.50.
  //
  // Query: "lays chips" → tokens: ["lays","chips"]  maxScore=16
  //   p3 "lays":  name(3)+brand(2)=5;  "chips": name(3)+tag(2)=5 → 10/16=0.625
  //   That's ≥ 0.625 which is MEDIUM (0.50 ≤ c < 0.75).
  //   p1 and p2 score 0 for both tokens → no alternatives that scored.
  //
  // To get alternatives, p1/p2 need partial matches too. Use "milk chips":
  //   tokens: ["milk","chips"]  maxScore=16
  //   p1 "milk":name(3)+tag(2)=5; "chips":0    → 5/16=0.3125 (< 0.50 excluded)
  //   p3 "milk":0; "chips":name(3)+tag(2)=5    → 5/16=0.3125 (< 0.50 excluded)
  //
  // The scoring sorts by normalized score (score/maxScore) but the CONFIDENCE
  // is still topProduct.score / topProduct.maxScore. We need the top product's
  // confidence to be in [0.50, 0.75).
  //
  // "lays chips" gives p3 at 10/16=0.625 → medium. p1 and p2 score 0 so the
  // result will have an empty alternatives array (only scored products are
  // considered, but the adapter slices positions 1-2 from scoredProducts which
  // are products with score > 0). We need at least one alternative.
  //
  // To manufacture alternatives: use a query token shared by p3 AND another
  // product. "snack" is in p3's tags. Use "snack bread":
  //   tokens: ["snack","bread"]  maxScore=16
  //   p3 "snack":tag(2)+category? "snacks".includes("snack")→yes(1)=3; "bread":0 → 3/16=0.1875
  //   p2 "snack":0; "bread": name(3)+tag(2)=5 → 5/16=0.3125
  //   Neither ≥ 0.50 so resolvedBy='none'.
  //
  // Correct approach: construct a query targeting two products so both score,
  // with the top one landing in [0.50, 0.75).
  //
  // Query: "britannia milk"
  //   tokens: ["britannia","milk"]  maxScore=16
  //   p2 "britannia": name(3)+brand(2)=5; "milk":0 → 5/16=0.3125 (< 0.50)
  //   p1 "britannia":0; "milk": name(3)+tag(2)=5  → 5/16=0.3125 (< 0.50)
  //   Both below threshold → resolvedBy='none'.
  //
  // The key insight: with a 2-token query, maxScore=16. To hit 0.50 the product
  // needs score ≥ 8. That requires both tokens to score at least 4 each, or one
  // to score 8 and the other to score 0. With one-field matches (score ≤5 per
  // token), you'd need at least two tokens that each score ≥4.
  //
  // Best bet for medium: single-token query giving 5/8=0.625.
  // For alternatives to appear, the adapter returns scoredProducts[1] and [2].
  // Since we need score > 0 for alternatives, we need other products also
  // matching on the same token.
  //
  // Token "snack": p3 tags=["chips","snack"] → tag(2)+category? "snacks".includes("snack")→yes(1) = 3/8=0.375
  // Token "grocery": p1 category(1), p2 category(1) → both 1/8=0.125
  // Token "lays": p3 name(3)+brand(2)=5/8=0.625 → medium, others 0
  //
  // None of the shared tokens push the TOP product to medium AND give alternatives.
  //
  // FINAL SOLUTION: craft a custom query that gives p1 medium confidence AND
  // makes p2/p3 score non-zero so they appear as alternatives.
  //
  // Query: "amul snack" → tokens: ["amul","snack"]  maxScore=16
  //   p1 "amul": name(3)+brand(2)+tag(2)=7; "snack":0  → 7/16=0.4375 (still < 0.50)
  //
  // Query: "amul lays" → tokens: ["amul","lays"]  maxScore=16
  //   p1 "amul":7; "lays":0 → 7/16=0.4375
  //   p3 "lays":5; "amul":0 → 5/16=0.3125
  //   p1 wins but at 0.4375 < 0.50.
  //
  // The pattern: with 2 tokens, maxScore=16. To get score/maxScore ≥ 0.50
  // we need score ≥ 8. The best single-token match we have is 7 (amul in p1).
  // So we'd need 7 on one token + at least 1 on the other → 8/16=0.50.
  //
  // Query: "amul grocery"  →  "grocery" is a stopword? No it's not in the list!
  // tokens: ["amul","grocery"]  maxScore=16
  //   p1 "amul":7; "grocery": category? "grocery".includes("grocery")=yes(1) → 8/16=0.50
  //   p2 "amul":0; "grocery":1 → 1/16=0.0625 (score>0, will be alternative)
  //   p3 "amul":0; "grocery":0 → 0 (filtered out)
  //
  // p1 confidence = 8/16 = 0.50 ✓ (meets 0.50 ≤ c < 0.75)
  // p2 will appear as an alternative (score=1 > 0)
  // p3 score=0 → filtered
  //
  // This gives exactly the medium-confidence scenario with at least one alternative!
  // -------------------------------------------------------------------------
  it('returns medium-confidence match (0.50 ≤ confidence < 0.75) with alternatives for "amul grocery"', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: PRODUCTS });

    const adapter = makeAdapter();
    const result = await adapter.resolveIntent('amul grocery', '110001', 'user-1');

    expect(result.productId).toBe('p1');
    expect(result.resolvedBy).toBe('text');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThan(0.75);
    // Medium confidence → alternatives must be present (1 or 2 entries)
    expect(result.alternatives).toBeDefined();
    expect(result.alternatives!.length).toBeGreaterThanOrEqual(1);
    expect(result.alternatives!.length).toBeLessThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // Scenario 3 – No match (query returns no scored products)
  // Query: "xyzmarzipan zap"  → tokens: ["xyzmarzipan","zap"]
  //   No product contains these strings → all scores = 0 → filtered
  //   Expects resolvedBy: 'none', suggestedInput contains normalized tokens
  // -------------------------------------------------------------------------
  it('returns resolvedBy "none" with suggestedInput for unrecognised query', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: PRODUCTS });

    const adapter = makeAdapter();
    const result = await adapter.resolveIntent('xyzmarzipan zap', '110001', 'user-1');

    expect(result.resolvedBy).toBe('none');
    expect(typeof result.suggestedInput).toBe('string');
    // suggestedInput should reflect the normalized/tokenized input
    expect(result.suggestedInput).toContain('xyzmarzipan');
    expect(result.confidence).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Scenario 4 – All stopwords
  // Query: "the a an" → all three are stopwords → tokens = []
  //   Expects resolvedBy: 'none', confidence: 0, no throw
  // -------------------------------------------------------------------------
  it('handles all-stopword query gracefully', async () => {
    // DynamoDB should NOT be called since tokenization yields empty tokens,
    // but we still set up the mock to avoid "no match" errors if it is called.
    ddbMock.on(ScanCommand).resolves({ Items: PRODUCTS });

    const adapter = makeAdapter();

    await expect(
      adapter.resolveIntent('the a an', '110001', 'user-1'),
    ).resolves.toMatchObject({
      resolvedBy: 'none',
      confidence: 0,
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 5 – DynamoDB SDK throws
  // The adapter must swallow the error and return a graceful failure result.
  // Expects resolvedBy: 'none', confidence: 0, no throw
  // -------------------------------------------------------------------------
  it('returns resolvedBy "none" and does not throw when DynamoDB rejects', async () => {
    ddbMock.on(ScanCommand).rejects(new Error('DynamoDB error'));

    const adapter = makeAdapter();

    await expect(
      adapter.resolveIntent('amul milk', '110001', 'user-1'),
    ).resolves.toMatchObject({
      resolvedBy: 'none',
      confidence: 0,
    });
  });
});
