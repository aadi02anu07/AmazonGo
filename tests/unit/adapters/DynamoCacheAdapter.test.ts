/**
 * Unit tests for DynamoCacheAdapter
 *
 * Uses aws-sdk-client-mock to intercept DynamoDBDocumentClient sends.
 * All 9 scenarios from task 10.1 are covered.
 */

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoCacheAdapter } from '../../../src/adapters/cache/DynamoCacheAdapter';

// Mock the entire DynamoDBDocumentClient class so every instance is intercepted
const ddbMock = mockClient(DynamoDBDocumentClient);

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const futureEpoch = (): number => Math.floor(Date.now() / 1000) + 3600;
const pastEpoch = (): number => Math.floor(Date.now() / 1000) - 1;

// ──────────────────────────────────────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────────────────────────────────────

describe('DynamoCacheAdapter', () => {
  let adapter: DynamoCacheAdapter;

  beforeEach(() => {
    ddbMock.reset();
    adapter = new DynamoCacheAdapter();
  });

  // ── 1. get — fresh hit ────────────────────────────────────────────────────

  it('get: returns parsed value for a fresh cache hit', async () => {
    const key = 'test-key-fresh';
    const payload = { foo: 'bar' };

    ddbMock.on(GetCommand).resolves({
      Item: {
        cacheKey: key,
        value: JSON.stringify(payload),
        ttl: futureEpoch(),
      },
    });

    const result = await adapter.get<{ foo: string }>(key);

    expect(result).toEqual(payload);
  });

  // ── 2. get — expired TTL ──────────────────────────────────────────────────

  it('get: returns null when the cached item has an expired TTL', async () => {
    const key = 'test-key-expired';

    ddbMock.on(GetCommand).resolves({
      Item: {
        cacheKey: key,
        value: '"data"',
        ttl: pastEpoch(),
      },
    });

    const result = await adapter.get<string>(key);

    expect(result).toBeNull();
  });

  // ── 3. get — key missing ──────────────────────────────────────────────────

  it('get: returns null when the Item is undefined (cache miss)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const result = await adapter.get<unknown>('missing-key');

    expect(result).toBeNull();
  });

  // ── 4. get — SDK throws ───────────────────────────────────────────────────

  it('get: returns null and does not throw when the SDK rejects', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB unavailable'));

    await expect(adapter.get<unknown>('error-key')).resolves.toBeNull();
  });

  // ── 5. set — happy path ───────────────────────────────────────────────────

  it('set: calls PutCommand with correct Item shape and ttl within ±2 seconds', async () => {
    ddbMock.on(PutCommand).resolves({});

    const key = 'set-key';
    const value = { product: 'milk', qty: 2 };
    const ttlSeconds = 300;

    const beforeCall = Math.floor(Date.now() / 1000);
    await adapter.set(key, value, ttlSeconds);
    const afterCall = Math.floor(Date.now() / 1000);

    // Inspect the captured call
    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);

    const item = calls[0]!.args[0].input.Item as Record<string, unknown>;

    expect(item['cacheKey']).toBe(key);
    expect(item['value']).toBe(JSON.stringify(value));

    const storedTtl = item['ttl'] as number;
    expect(storedTtl).toBeGreaterThanOrEqual(beforeCall + ttlSeconds - 2);
    expect(storedTtl).toBeLessThanOrEqual(afterCall + ttlSeconds + 2);
  });

  // ── 6. set — SDK throws ───────────────────────────────────────────────────

  it('set: does not throw when the SDK rejects', async () => {
    ddbMock.on(PutCommand).rejects(new Error('Write failed'));

    await expect(adapter.set('key', { x: 1 }, 60)).resolves.toBeUndefined();
  });

  // ── 7. del — happy path ───────────────────────────────────────────────────

  it('del: calls DeleteCommand with the correct Key', async () => {
    ddbMock.on(DeleteCommand).resolves({});

    const key = 'delete-this-key';
    await adapter.del(key);

    const calls = ddbMock.commandCalls(DeleteCommand);
    expect(calls).toHaveLength(1);

    const inputKey = calls[0]!.args[0].input.Key as Record<string, unknown>;
    expect(inputKey).toEqual({ cacheKey: key });
  });

  // ── 8. del — SDK throws ───────────────────────────────────────────────────

  it('del: does not throw when the SDK rejects', async () => {
    ddbMock.on(DeleteCommand).rejects(new Error('Delete failed'));

    await expect(adapter.del('any-key')).resolves.toBeUndefined();
  });

  // ── 9. mget — mixed hits / misses ─────────────────────────────────────────

  it('mget: returns values for hits, null for expired entries and misses', async () => {
    const keys = ['hit-key', 'expired-key', 'missing-key'];
    const hitPayload = { name: 'apple juice' };
    const tableName = process.env.DYNAMODB_TABLE_PREFIX
      ? `${process.env.DYNAMODB_TABLE_PREFIX}SnapCache`
      : 'Dev-SnapCache';

    ddbMock.on(BatchGetCommand).resolves({
      Responses: {
        [tableName]: [
          // fresh hit
          {
            cacheKey: 'hit-key',
            value: JSON.stringify(hitPayload),
            ttl: futureEpoch(),
          },
          // expired — should be treated as null
          {
            cacheKey: 'expired-key',
            value: '"stale"',
            ttl: pastEpoch(),
          },
          // 'missing-key' is simply absent from the response
        ],
      },
    });

    const results = await adapter.mget<{ name: string }>(keys);

    expect(results).toHaveLength(keys.length);
    expect(results[0]).toEqual(hitPayload);  // hit-key
    expect(results[1]).toBeNull();            // expired-key
    expect(results[2]).toBeNull();            // missing-key
  });
});
