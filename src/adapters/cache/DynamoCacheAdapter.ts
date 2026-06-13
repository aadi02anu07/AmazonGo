/**
 * Amazon Now Snap — DynamoCacheAdapter
 * 
 * Hackathon Mode Cache Adapter using DynamoDB as a cache store.
 * Replaces ElastiCache Redis with zero cost.
 * 
 * Table: SnapCache
 * - PK: cacheKey (string)
 * - value (string, JSON-serialized)
 * - ttl (number, Unix epoch for DynamoDB TTL)
 * - createdAt (string, ISO 8601)
 * 
 * Rules (from Rules.md § 13.3):
 * - Always set ttl = Math.floor(Date.now() / 1000) + ttlSeconds
 * - Always check item.ttl > Math.floor(Date.now() / 1000) on read
 * - Never perform Scan on SnapCache — always use cacheKey PK
 * - Log 'searchMode: dynamo' for monitoring
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { CacheAdapter } from '../interfaces';
import { logger } from '@utils/logger';

export class DynamoCacheAdapter implements CacheAdapter {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-south-1',
      ...(process.env.DYNAMODB_ENDPOINT && {
        endpoint: process.env.DYNAMODB_ENDPOINT,
      }),
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.DYNAMODB_TABLE_PREFIX
      ? `${process.env.DYNAMODB_TABLE_PREFIX}SnapCache`
      : 'Dev-SnapCache';

    logger.info({
      message: 'DynamoCacheAdapter initialized',
      tableName: this.tableName,
      mode: 'hackathon',
    });
  }

  /**
   * Get a value from cache
   * CRITICAL: Always validate TTL before returning (DynamoDB TTL is eventual)
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { cacheKey: key },
      });

      const response = await this.client.send(command);

      if (!response.Item) {
        logger.debug({
          message: 'Cache miss',
          cacheKey: key,
          adapter: 'DynamoCache',
        });
        return null;
      }

      // CRITICAL: Validate TTL (DynamoDB TTL deletion is eventual, not real-time)
      const now = Math.floor(Date.now() / 1000);
      if (response.Item.ttl && response.Item.ttl <= now) {
        logger.debug({
          message: 'Cache entry expired',
          cacheKey: key,
          ttl: response.Item.ttl,
          now,
          adapter: 'DynamoCache',
        });
        return null;
      }

      // Parse JSON value
      const value = JSON.parse(response.Item.value as string) as T;

      logger.debug({
        message: 'Cache hit',
        cacheKey: key,
        adapter: 'DynamoCache',
      });

      return value;
    } catch (error) {
      logger.error({
        message: 'Cache get failed',
        cacheKey: key,
        error,
        adapter: 'DynamoCache',
      });
      // Don't throw - gracefully return null and let caller handle cache miss
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const ttl = now + ttlSeconds;

      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          cacheKey: key,
          value: JSON.stringify(value),
          ttl,
          createdAt: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      logger.debug({
        message: 'Cache set',
        cacheKey: key,
        ttlSeconds,
        expiresAt: new Date(ttl * 1000).toISOString(),
        adapter: 'DynamoCache',
      });
    } catch (error) {
      logger.error({
        message: 'Cache set failed',
        cacheKey: key,
        error,
        adapter: 'DynamoCache',
      });
      // Don't throw - cache write failure shouldn't break the request
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { cacheKey: key },
      });

      await this.client.send(command);

      logger.debug({
        message: 'Cache key deleted',
        cacheKey: key,
        adapter: 'DynamoCache',
      });
    } catch (error) {
      logger.error({
        message: 'Cache delete failed',
        cacheKey: key,
        error,
        adapter: 'DynamoCache',
      });
      // Don't throw
    }
  }

  /**
   * Batch get multiple keys
   * Limited to 100 keys per batch (DynamoDB BatchGetItem limit)
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    if (keys.length === 0) {
      return [];
    }

    // DynamoDB BatchGetItem has a limit of 100 items
    if (keys.length > 100) {
      logger.warn({
        message: 'mget called with >100 keys, splitting into batches',
        keyCount: keys.length,
        adapter: 'DynamoCache',
      });

      const batches: string[][] = [];
      for (let i = 0; i < keys.length; i += 100) {
        batches.push(keys.slice(i, i + 100));
      }

      const results = await Promise.all(batches.map((batch) => this.mget<T>(batch)));
      return results.flat();
    }

    try {
      const command = new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: keys.map((key) => ({ cacheKey: key })),
          },
        },
      });

      const response = await this.client.send(command);
      const items = response.Responses?.[this.tableName] || [];

      // Create a map of key -> value
      const itemMap = new Map<string, T>();
      const now = Math.floor(Date.now() / 1000);

      for (const item of items) {
        // Validate TTL
        if (item.ttl && item.ttl > now) {
          const value = JSON.parse(item.value as string) as T;
          itemMap.set(item.cacheKey as string, value);
        }
      }

      // Return results in the same order as input keys
      const results = keys.map((key) => itemMap.get(key) ?? null);

      logger.debug({
        message: 'Batch cache get',
        requestedKeys: keys.length,
        foundKeys: itemMap.size,
        adapter: 'DynamoCache',
      });

      return results;
    } catch (error) {
      logger.error({
        message: 'Batch cache get failed',
        keyCount: keys.length,
        error,
        adapter: 'DynamoCache',
      });
      // Return all nulls on error
      return keys.map(() => null);
    }
  }
}
