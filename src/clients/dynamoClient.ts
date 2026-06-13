/**
 * Amazon Now Snap — DynamoDB Client
 * 
 * Centralized DynamoDB client with consistent configuration.
 * All services should import from here, not create their own clients.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

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
