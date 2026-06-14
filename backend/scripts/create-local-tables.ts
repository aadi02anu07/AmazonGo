/**
 * Amazon Now Snap — Create Local DynamoDB Tables
 *
 * Creates all 9 Dev-Snap* tables in DynamoDB Local.
 * Run this once after starting the local DynamoDB container.
 * Usage: ts-node --project scripts/tsconfig.json -r tsconfig-paths/register scripts/create-local-tables.ts
 */

import { CreateTableCommand, CreateTableCommandInput, DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: 'ap-south-1',
  endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

const PREFIX = process.env.DYNAMODB_TABLE_PREFIX ?? 'Dev-';

async function createTableIfNotExists(params: CreateTableCommandInput): Promise<void> {
  try {
    await client.send(new CreateTableCommand(params));
    console.log(`✅ Created: ${params.TableName}`);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ResourceInUseException') {
      console.log(`⏭  Exists:  ${params.TableName}`);
    } else {
      throw err;
    }
  }
}

async function main(): Promise<void> {
  console.log(`\nCreating tables with prefix "${PREFIX}" at ${process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000'}\n`);

  // 1. SnapUsers
  await createTableIfNotExists({
    TableName: `${PREFIX}SnapUsers`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });

  // 2. SnapAddresses
  await createTableIfNotExists({
    TableName: `${PREFIX}SnapAddresses`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'addressId', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'addressId', KeyType: 'RANGE' },
    ],
  });

  // 3. SnapProducts
  await createTableIfNotExists({
    TableName: `${PREFIX}SnapProducts`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'productId', AttributeType: 'S' },
      { AttributeName: 'sku', AttributeType: 'S' },
      { AttributeName: 'category', AttributeType: 'S' },
      { AttributeName: 'subCategory', AttributeType: 'S' },
      { AttributeName: 'brand', AttributeType: 'S' },
      { AttributeName: 'barcode', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'productId', KeyType: 'HASH' },
      { AttributeName: 'sku', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'CategoryIndex',
        KeySchema: [
          { AttributeName: 'category', KeyType: 'HASH' },
          { AttributeName: 'subCategory', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'BrandIndex',
        KeySchema: [
          { AttributeName: 'brand', KeyType: 'HASH' },
          { AttributeName: 'productId', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'KEYS_ONLY' },
      },
      {
        IndexName: 'BarcodeIndex',
        KeySchema: [
          { AttributeName: 'barcode', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    StreamSpecification: { StreamEnabled: true, StreamViewType: 'NEW_AND_OLD_IMAGES' },
  });

  // 4. SnapInventory
  await createTableIfNotExists({
    TableName: `${PREFIX}SnapInventory`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'pincodeProductId', AttributeType: 'S' },
      { AttributeName: 'pincode', AttributeType: 'S' },
      { AttributeName: 'productId', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'pincodeProductId', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'PincodeIndex',
        KeySchema: [
          { AttributeName: 'pincode', KeyType: 'HASH' },
          { AttributeName: 'productId', KeyType: 'RANGE' },
        ],
        Projection: {
          ProjectionType: 'INCLUDE',
          NonKeyAttributes: ['isAvailableFor10Min', 'stockLevel', 'darkStoreId'],
        },
      },
    ],
    StreamSpecification: { StreamEnabled: true, StreamViewType: 'NEW_AND_OLD_IMAGES' },
  });

  // 5. SnapOrders
  await createTableIfNotExists({
    TableName: `${PREFIX}SnapOrders`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'orderId', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'orderId', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'StatusIndex',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: {
          ProjectionType: 'INCLUDE',
          NonKeyAttributes: ['userId', 'orderId', 'total', 'pincode', 'darkStoreId'],
        },
      },
    ],
  });

  // 6. SnapPurchaseCadence (with TTL)
  await createTableIfNotExists({
    TableName: `${PREFIX}SnapPurchaseCadence`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'productId', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'productId', KeyType: 'RANGE' },
    ],
  });

  // 7. SnapDarkStores
  await createTableIfNotExists({
    TableName: `${PREFIX}SnapDarkStores`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'darkStoreId', AttributeType: 'S' },
      { AttributeName: 'city', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'darkStoreId', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'CityIndex',
        KeySchema: [
          { AttributeName: 'city', KeyType: 'HASH' },
          { AttributeName: 'darkStoreId', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });

  // 8. SnapCache (with TTL)
  await createTableIfNotExists({
    TableName: `${PREFIX}SnapCache`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [{ AttributeName: 'cacheKey', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'cacheKey', KeyType: 'HASH' }],
  });

  // 9. SnapSearchIndex
  await createTableIfNotExists({
    TableName: `${PREFIX}SnapSearchIndex`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'token', AttributeType: 'S' },
      { AttributeName: 'productId', AttributeType: 'S' },
      { AttributeName: 'category', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'token', KeyType: 'HASH' },
      { AttributeName: 'productId', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'CategoryIndex',
        KeySchema: [
          { AttributeName: 'category', KeyType: 'HASH' },
          { AttributeName: 'token', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });

  // Verify
  const list = await client.send(new ListTablesCommand({}));
  console.log(`\n✅ Done! Tables in local DynamoDB: ${list.TableNames?.join(', ')}\n`);
}

main().catch((err: unknown) => {
  console.error('Failed to create tables:', err);
  process.exitCode = 1;
});
