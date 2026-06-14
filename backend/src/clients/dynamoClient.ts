/**
 * Amazon Now Snap — DynamoDB Client
 * 
 * Centralized DynamoDB client with consistent configuration.
 * All services should import from here, not create their own clients.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '@utils/logger';
import { AppError, ErrorCodes } from '@constants/errors';

// Create base DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.DYNAMODB_ENDPOINT && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
  }),
});

// Create Document Client with marshalling options
export const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true, // Remove undefined values
    convertEmptyValues: false, // Don't convert empty strings/sets
  },
  unmarshallOptions: {
    wrapNumbers: false, // Return numbers as JavaScript numbers, not BigInt
  },
});

// Table name helper
export function getTableName(entity: string): string {
  const prefix = process.env.DYNAMODB_TABLE_PREFIX || 'Dev-';
  return `${prefix}Snap${entity}`;
}

// Export table names as constants
export const TABLE_NAMES = {
  USERS: getTableName('Users'),
  ADDRESSES: getTableName('Addresses'),
  PRODUCTS: getTableName('Products'),
  INVENTORY: getTableName('Inventory'),
  ORDERS: getTableName('Orders'),
  PURCHASE_CADENCE: getTableName('PurchaseCadence'),
  DARK_STORES: getTableName('DarkStores'),
  CACHE: getTableName('Cache'),
  SEARCH_INDEX: getTableName('SearchIndex'),
} as const;

// ============================================================================
// DynamoDB Helper Functions
// ============================================================================

/**
 * Get a single item from DynamoDB by primary key.
 * Returns null if the item does not exist.
 * Wraps DynamoDB SDK errors as AppError(DATABASE_ERROR, 500, retryable: true).
 */
export async function getItem<T>(
  tableName: string,
  key: Record<string, unknown>
): Promise<T | null> {
  try {
    const result = await docClient.send(
      new GetCommand({ TableName: tableName, Key: key })
    );
    return (result.Item as T) ?? null;
  } catch (error) {
    logger.error({ message: 'DynamoDB getItem error', tableName, error });
    throw new AppError(ErrorCodes.DATABASE_ERROR, (error as Error).message, 500, true);
  }
}

/**
 * Put an item into DynamoDB (overwrites if exists unless ConditionExpression is used).
 * Wraps DynamoDB SDK errors as AppError(DATABASE_ERROR, 500, retryable: true).
 */
export async function putItem<T extends Record<string, unknown>>(
  tableName: string,
  item: T
): Promise<void> {
  try {
    await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
  } catch (error) {
    logger.error({ message: 'DynamoDB putItem error', tableName, error });
    throw new AppError(ErrorCodes.DATABASE_ERROR, (error as Error).message, 500, true);
  }
}

/**
 * Update an item in DynamoDB.
 * @param expressionAttributeNames - Required when attribute names are reserved words.
 * @param conditionExpression - Optional conditional update.
 */
export async function updateItem(
  tableName: string,
  key: Record<string, unknown>,
  updateExpression: string,
  expressionAttributeValues: Record<string, unknown>,
  expressionAttributeNames?: Record<string, string>,
  conditionExpression?: string
): Promise<void> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ...(expressionAttributeNames && { ExpressionAttributeNames: expressionAttributeNames }),
        ...(conditionExpression && { ConditionExpression: conditionExpression }),
      })
    );
  } catch (error) {
    logger.error({ message: 'DynamoDB updateItem error', tableName, error });
    throw new AppError(ErrorCodes.DATABASE_ERROR, (error as Error).message, 500, true);
  }
}

/**
 * Delete an item from DynamoDB by primary key.
 */
export async function deleteItem(
  tableName: string,
  key: Record<string, unknown>
): Promise<void> {
  try {
    await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
  } catch (error) {
    logger.error({ message: 'DynamoDB deleteItem error', tableName, error });
    throw new AppError(ErrorCodes.DATABASE_ERROR, (error as Error).message, 500, true);
  }
}

/**
 * Query items from DynamoDB with optional index, limit, and pagination.
 * Returns items array and a Base64-encoded nextCursor when there are more results.
 * Cursor encoding: Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64')
 * Cursor decoding: JSON.parse(Buffer.from(cursor, 'base64').toString())
 */
export async function queryItems<T>(params: {
  tableName: string;
  keyConditionExpression: string;
  expressionAttributeValues: Record<string, unknown>;
  expressionAttributeNames?: Record<string, string>;
  indexName?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  scanIndexForward?: boolean;
}): Promise<{ items: T[]; nextCursor?: string }> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: params.tableName,
        KeyConditionExpression: params.keyConditionExpression,
        ExpressionAttributeValues: params.expressionAttributeValues,
        ...(params.expressionAttributeNames && {
          ExpressionAttributeNames: params.expressionAttributeNames,
        }),
        ...(params.indexName && { IndexName: params.indexName }),
        ...(params.limit !== undefined && { Limit: params.limit }),
        ...(params.exclusiveStartKey && {
          ExclusiveStartKey: params.exclusiveStartKey,
        }),
        ...(params.scanIndexForward !== undefined && {
          ScanIndexForward: params.scanIndexForward,
        }),
      })
    );

    const items = (result.Items ?? []) as T[];
    const nextCursor = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { items, nextCursor };
  } catch (error) {
    logger.error({ message: 'DynamoDB queryItems error', tableName: params.tableName, error });
    throw new AppError(ErrorCodes.DATABASE_ERROR, (error as Error).message, 500, true);
  }
}

/**
 * Batch get items from DynamoDB by primary keys.
 * Splits keys into chunks of 100 (DynamoDB BatchGetItem limit) and merges results.
 */
export async function batchGetItems<T>(
  tableName: string,
  keys: Record<string, unknown>[]
): Promise<T[]> {
  if (keys.length === 0) return [];

  const chunks: Record<string, unknown>[][] = [];
  for (let i = 0; i < keys.length; i += 100) {
    chunks.push(keys.slice(i, i + 100));
  }

  try {
    const results = await Promise.all(
      chunks.map((chunk) =>
        docClient.send(
          new BatchGetCommand({
            RequestItems: {
              [tableName]: { Keys: chunk },
            },
          })
        )
      )
    );

    return results.flatMap(
      (r) => ((r.Responses?.[tableName] ?? []) as T[])
    );
  } catch (error) {
    logger.error({ message: 'DynamoDB batchGetItems error', tableName, error });
    throw new AppError(ErrorCodes.DATABASE_ERROR, (error as Error).message, 500, true);
  }
}

/**
 * Scan items from DynamoDB with an optional filter expression.
 * Use sparingly — table scans are expensive at scale.
 * For targeted lookups, prefer queryItems with a GSI.
 */
export async function scanItems<T>(params: {
  tableName: string;
  filterExpression?: string;
  expressionAttributeValues?: Record<string, unknown>;
  expressionAttributeNames?: Record<string, string>;
}): Promise<T[]> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: params.tableName,
        ...(params.filterExpression && {
          FilterExpression: params.filterExpression,
        }),
        ...(params.expressionAttributeValues && {
          ExpressionAttributeValues: params.expressionAttributeValues,
        }),
        ...(params.expressionAttributeNames && {
          ExpressionAttributeNames: params.expressionAttributeNames,
        }),
      })
    );
    return (result.Items ?? []) as T[];
  } catch (error) {
    logger.error({ message: 'DynamoDB scanItems error', tableName: params.tableName, error });
    throw new AppError(ErrorCodes.DATABASE_ERROR, (error as Error).message, 500, true);
  }
}
