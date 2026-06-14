import * as cdk from 'aws-cdk-lib';
import { AttributeType, ProjectionType, StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { SnapDynamoTable } from '../constructs/SnapDynamoTable';

export interface SnapDatabaseStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

/**
 * CDK Stack that provisions all nine DynamoDB tables for the Amazon Now Snap backend.
 *
 * Every table is created via SnapDynamoTable (project-standard Level-2 construct),
 * which enforces on-demand billing, PITR, AWS-managed encryption, and the
 * environment-appropriate removal policy.
 */
export class SnapDatabaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SnapDatabaseStackProps) {
    super(scope, id, props);

    const { config } = props;
    const p = config.tablePrefix;
    const rp = config.removalPolicy;

    // -------------------------------------------------------------------------
    // TABLE 1: SnapUsers
    // PK: userId (S)
    // GSI EmailIndex: PK email (S), projection ALL
    // -------------------------------------------------------------------------
    const snapUsers = new SnapDynamoTable(this, 'SnapUsers', {
      tableName: `${p}SnapUsers`,
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      removalPolicy: rp,
    });

    snapUsers.table.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    // -------------------------------------------------------------------------
    // TABLE 2: SnapAddresses
    // PK: userId (S), SK: addressId (S)
    // No GSIs
    // -------------------------------------------------------------------------
    new SnapDynamoTable(this, 'SnapAddresses', {
      tableName: `${p}SnapAddresses`,
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'addressId', type: AttributeType.STRING },
      removalPolicy: rp,
    });

    // -------------------------------------------------------------------------
    // TABLE 3: SnapProducts
    // PK: productId (S), SK: sku (S)
    // GSI CategoryIndex: PK category (S), SK subCategory (S), projection ALL
    // GSI BrandIndex: PK brand (S), SK productId (S), projection KEYS_ONLY
    // Streams: NEW_AND_OLD_IMAGES
    // -------------------------------------------------------------------------
    const snapProducts = new SnapDynamoTable(this, 'SnapProducts', {
      tableName: `${p}SnapProducts`,
      partitionKey: { name: 'productId', type: AttributeType.STRING },
      sortKey: { name: 'sku', type: AttributeType.STRING },
      removalPolicy: rp,
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
    });

    snapProducts.table.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: { name: 'category', type: AttributeType.STRING },
      sortKey: { name: 'subCategory', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    snapProducts.table.addGlobalSecondaryIndex({
      indexName: 'BrandIndex',
      partitionKey: { name: 'brand', type: AttributeType.STRING },
      sortKey: { name: 'productId', type: AttributeType.STRING },
      projectionType: ProjectionType.KEYS_ONLY,
    });

    // -------------------------------------------------------------------------
    // TABLE 4: SnapInventory
    // PK: pincodeProductId (S), no SK
    // GSI PincodeIndex: PK pincode (S), SK productId (S),
    //   projection INCLUDE [isAvailableFor10Min, stockLevel, darkStoreId]
    // Streams: NEW_AND_OLD_IMAGES
    // -------------------------------------------------------------------------
    const snapInventory = new SnapDynamoTable(this, 'SnapInventory', {
      tableName: `${p}SnapInventory`,
      partitionKey: { name: 'pincodeProductId', type: AttributeType.STRING },
      removalPolicy: rp,
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
    });

    snapInventory.table.addGlobalSecondaryIndex({
      indexName: 'PincodeIndex',
      partitionKey: { name: 'pincode', type: AttributeType.STRING },
      sortKey: { name: 'productId', type: AttributeType.STRING },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: ['isAvailableFor10Min', 'stockLevel', 'darkStoreId'],
    });

    // -------------------------------------------------------------------------
    // TABLE 5: SnapOrders
    // PK: userId (S), SK: orderId (S)
    // GSI StatusIndex: PK status (S), SK createdAt (S),
    //   projection INCLUDE [userId, orderId, total, pincode, darkStoreId]
    // -------------------------------------------------------------------------
    const snapOrders = new SnapDynamoTable(this, 'SnapOrders', {
      tableName: `${p}SnapOrders`,
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'orderId', type: AttributeType.STRING },
      removalPolicy: rp,
    });

    snapOrders.table.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: AttributeType.STRING },
      sortKey: { name: 'createdAt', type: AttributeType.STRING },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: ['userId', 'orderId', 'total', 'pincode', 'darkStoreId'],
    });

    // -------------------------------------------------------------------------
    // TABLE 6: SnapPurchaseCadence
    // PK: userId (S), SK: productId (S)
    // TTL attribute: ttl
    // -------------------------------------------------------------------------
    new SnapDynamoTable(this, 'SnapPurchaseCadence', {
      tableName: `${p}SnapPurchaseCadence`,
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'productId', type: AttributeType.STRING },
      removalPolicy: rp,
      timeToLiveAttribute: 'ttl',
    });

    // -------------------------------------------------------------------------
    // TABLE 7: SnapDarkStores
    // PK: darkStoreId (S), no SK
    // GSI CityIndex: PK city (S), SK darkStoreId (S), projection ALL
    // -------------------------------------------------------------------------
    const snapDarkStores = new SnapDynamoTable(this, 'SnapDarkStores', {
      tableName: `${p}SnapDarkStores`,
      partitionKey: { name: 'darkStoreId', type: AttributeType.STRING },
      removalPolicy: rp,
    });

    snapDarkStores.table.addGlobalSecondaryIndex({
      indexName: 'CityIndex',
      partitionKey: { name: 'city', type: AttributeType.STRING },
      sortKey: { name: 'darkStoreId', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    // -------------------------------------------------------------------------
    // TABLE 8: SnapCache
    // PK: cacheKey (S), no SK
    // TTL attribute: ttl
    // -------------------------------------------------------------------------
    new SnapDynamoTable(this, 'SnapCache', {
      tableName: `${p}SnapCache`,
      partitionKey: { name: 'cacheKey', type: AttributeType.STRING },
      removalPolicy: rp,
      timeToLiveAttribute: 'ttl',
    });

    // -------------------------------------------------------------------------
    // TABLE 9: SnapSearchIndex
    // PK: token (S), SK: productId (S)
    // GSI CategoryIndex: PK category (S), SK token (S), projection ALL
    // -------------------------------------------------------------------------
    const snapSearchIndex = new SnapDynamoTable(this, 'SnapSearchIndex', {
      tableName: `${p}SnapSearchIndex`,
      partitionKey: { name: 'token', type: AttributeType.STRING },
      sortKey: { name: 'productId', type: AttributeType.STRING },
      removalPolicy: rp,
    });

    snapSearchIndex.table.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: { name: 'category', type: AttributeType.STRING },
      sortKey: { name: 'token', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });
  }
}
