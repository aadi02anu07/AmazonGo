# Requirements Document

## Introduction

This spec covers the core backend scaffold for **Amazon Now Snap** — a quick-commerce AWS serverless backend built on TypeScript strict mode, AWS CDK, DynamoDB, and Lambda. The existing codebase already provides the adapter factory, all six adapter implementations (DynamoCacheAdapter, DynamoSearchAdapter, KeywordIntentAdapter, RuleBasedRecommendationAdapter, BarcodeVisionAdapter, BrowserSpeechAdapter), a structured logger, a standard response formatter, and error constants.

The scaffold to be built spans five ordered steps:
1. CDK infrastructure (DynamoDB tables via reusable constructs)
2. Dev seed data script (idempotent)
3. DynamoDB client helpers (singleton DocumentClient with typed wrappers)
4. Products service (model types, service functions, Lambda handlers)
5. Unit tests (adapters and product service)

All code must comply with the mandatory rules: TypeScript strict mode, no `any`, no `console.log`, all monetary values in paise (integers), all timestamps in ISO 8601 UTC, zod validation before business logic, userId always from JWT claims, and all handlers wrapped in try/catch returning AppError-aware error responses.

---

## Glossary

- **CDK_App**: The AWS CDK application entry point that synthesises CloudFormation templates for all stacks.
- **SnapDynamoTable**: Reusable CDK Level-2 construct wrapping `TableV2` with project-standard defaults.
- **SnapDatabaseStack**: CDK stack that provisions all nine DynamoDB tables with their GSIs, streams, and TTLs.
- **DocumentClient**: AWS SDK v3 `DynamoDBDocumentClient` singleton used by all service code.
- **DynamoHelpers**: Typed wrapper functions (`getItem`, `putItem`, `updateItem`, `deleteItem`, `queryItems`, `batchGetItems`) exported from `src/clients/dynamoClient.ts`.
- **ProductService**: The business-logic layer for product queries; pure functions with no direct AWS SDK use beyond the DynamoHelpers.
- **ProductsHandler**: The Lambda handler file for the four product routes; applies zod validation and delegates to ProductService.
- **SearchIndex**: The `Dev-SnapSearchIndex` DynamoDB table used by `DynamoSearchAdapter` for keyword search in Hackathon Mode.
- **SeedScript**: The `scripts/seed-dev-data.ts` idempotent script that populates all tables for local and dev-environment testing.
- **DYNAMODB_TABLE_PREFIX**: The environment variable that determines the table name prefix (`Dev-`, `Staging-`, or empty for prod). Defaults to `Dev-` when absent.
- **DYNAMODB_ENDPOINT**: Environment variable for custom DynamoDB endpoint (used for local development pointing at `http://localhost:8000`).
- **Paise**: Integer unit for all monetary amounts; 1 INR = 100 paise (e.g., ₹32.00 = 3200).
- **AppError**: Typed error class from `src/constants/errors.ts` with constructor signature `(code: string, message: string, statusCode: number, retryable?: boolean)`.

---

## Requirements

---

### Requirement 1: Reusable CDK DynamoDB Construct

**User Story:** As an infrastructure engineer, I want a reusable CDK construct for DynamoDB tables, so that all tables are created with consistent security, billing, and recovery settings without duplicating configuration.

#### Acceptance Criteria

1. THE `SnapDynamoTable` Construct SHALL accept `tableName` (a string of 3–255 characters containing only alphanumeric characters, hyphens, underscores, or dots), `partitionKey` (a name and type, where type is one of `S`, `N`, or `B`), and an optional `sortKey` (a name and type, where type is one of `S`, `N`, or `B`) as constructor inputs.
2. THE `SnapDynamoTable` Construct SHALL set billing mode to `PAY_PER_REQUEST` (on-demand) on every table it creates.
3. THE `SnapDynamoTable` Construct SHALL enable Point-In-Time Recovery (PITR) on every table it creates.
4. THE `SnapDynamoTable` Construct SHALL apply `AWS_MANAGED` encryption to every table it creates.
5. IF the CDK context variable `env` is `prod`, THEN THE `SnapDynamoTable` Construct SHALL set `removalPolicy` to `RETAIN`; the `prod` condition and the `dev`/`staging` condition are mutually exclusive and SHALL NOT overlap.
6. IF the CDK context variable `env` is `dev` or `staging`, THEN THE `SnapDynamoTable` Construct SHALL set `removalPolicy` to `DESTROY`; `dev` SHALL always use `DESTROY` and SHALL NOT be allowed to use `RETAIN`.
7. IF the CDK context variable `env` is absent or is not one of `prod`, `dev`, or `staging`, THEN THE `SnapDynamoTable` Construct SHALL throw an error immediately during construct instantiation (not deferred to synthesis time) indicating that the `env` context variable is missing or unrecognized.
8. THE `SnapDynamoTable` Construct SHALL expose the underlying `TableV2` instance as a public property named `table` so callers can add GSIs and enable streams.

---

### Requirement 2: CDK Environment Configuration

**User Story:** As an infrastructure engineer, I want environment-specific CDK configuration, so that dev, staging, and production deployments use the correct AWS account, region, table prefix, and removal policy without manual editing.

#### Acceptance Criteria

1. THE `environments.ts` Config SHALL define a typed `EnvironmentConfig` interface with fields: `account` (string), `region` (string), `stage` (string), `tablePrefix` (string), and `removalPolicy` (CDK `RemovalPolicy` enum value).
2. THE `environments.ts` Config SHALL export configs for three named environments: `dev`, `staging`, and `prod`.
3. IF `env=dev`, THEN THE Config SHALL set `tablePrefix` to `"Dev-"` and `removalPolicy` to `DESTROY`; `dev` SHALL always use `DESTROY` and SHALL NOT be permitted to use `RETAIN`.
4. IF `env=staging`, THEN THE Config SHALL set `tablePrefix` to `"Staging-"` and `removalPolicy` to `DESTROY`; `staging` SHALL always use `DESTROY` and SHALL NOT be permitted to use `RETAIN`.
5. IF `env=prod`, THEN THE Config SHALL set `tablePrefix` to `""` (empty string — no prefix for production tables) and `removalPolicy` to `RETAIN`; the `prod`, `dev`, and `staging` environments are mutually exclusive and their removal policies SHALL NOT be mixed.
6. THE `environments.ts` Config SHALL read `account` from `process.env.CDK_DEFAULT_ACCOUNT` and `region` from `process.env.CDK_DEFAULT_REGION`, defaulting to `'ap-south-1'` for region when the env var is absent.
7. IF an `env` value is provided that is not one of `dev`, `staging`, or `prod`, THEN THE Config SHALL throw a descriptive error naming the unrecognised value and listing the three valid options.

---

### Requirement 3: CDK DynamoDB Stack — All Nine Tables

**User Story:** As an infrastructure engineer, I want all nine application DynamoDB tables provisioned by a single CDK stack, so that one `cdk deploy` creates all required tables with the correct access patterns, GSIs, TTLs, and streams.

#### Acceptance Criteria

1. THE `SnapDatabaseStack` SHALL provision `{prefix}SnapUsers` with `userId` (String) as partition key, a `EmailIndex` GSI with `email` (String) as partition key and `ALL` projection type, and no sort key on the base table.
2. THE `SnapDatabaseStack` SHALL provision `{prefix}SnapAddresses` with `userId` (String) as partition key and `addressId` (String) as sort key, with `ALL` projection type on all GSIs.
3. THE `SnapDatabaseStack` SHALL provision `{prefix}SnapProducts` with `productId` (String) as partition key and `sku` (String) as sort key, a `CategoryIndex` GSI (`PK: category String, SK: subCategory String`, `ALL` projection), a `BrandIndex` GSI (`PK: brand String, SK: productId String`, `KEYS_ONLY` projection), and DynamoDB Streams set to `NEW_AND_OLD_IMAGES`.
4. THE `SnapDatabaseStack` SHALL provision `{prefix}SnapInventory` with `pincodeProductId` (String) as partition key, no sort key on the base table, a `PincodeIndex` GSI (`PK: pincode String, SK: productId String`, `INCLUDE` projection with `isAvailableFor10Min`, `stockLevel`, `darkStoreId`), and DynamoDB Streams set to `NEW_AND_OLD_IMAGES`.
5. THE `SnapDatabaseStack` SHALL provision `{prefix}SnapOrders` with `userId` (String) as partition key, `orderId` (String) as sort key, and a `StatusIndex` GSI (`PK: status String, SK: createdAt String`, `INCLUDE` projection with `userId`, `orderId`, `total`, `pincode`, `darkStoreId`).
6. THE `SnapDatabaseStack` SHALL provision `{prefix}SnapPurchaseCadence` with `userId` (String) as partition key, `productId` (String) as sort key, and TTL enabled on the `ttl` attribute.
7. THE `SnapDatabaseStack` SHALL provision `{prefix}SnapDarkStores` with `darkStoreId` (String) as partition key and a `CityIndex` GSI (`PK: city String, SK: darkStoreId String`, `ALL` projection).
8. THE `SnapDatabaseStack` SHALL provision `{prefix}SnapCache` with `cacheKey` (String) as partition key and TTL enabled on the `ttl` attribute.
9. THE `SnapDatabaseStack` SHALL provision `{prefix}SnapSearchIndex` with `token` (String) as partition key, `productId` (String) as sort key, and a `CategoryIndex` GSI (`PK: category String, SK: token String`, `ALL` projection).
10. WHEN the CDK context variable `env` is provided, THE `SnapDatabaseStack` SHALL apply the corresponding `tablePrefix` and `removalPolicy` from `environments.ts` to all tables it creates. WHEN `env` is absent, THE `SnapDatabaseStack` SHALL default to the `dev` configuration and SHALL proceed with deployment even if loading the dev configuration produces a non-fatal warning.

---

### Requirement 4: CDK Application Entry Point

**User Story:** As an infrastructure engineer, I want a CDK app entry point, so that `cdk deploy`, `cdk synth`, and `cdk diff` commands work correctly against the right AWS account and region.

#### Acceptance Criteria

1. THE `CDK_App` SHALL read the `env` context key (via `app.node.tryGetContext('env')`) and default to `"dev"` when not provided.
2. THE `CDK_App` SHALL instantiate `SnapDatabaseStack` and pass the resolved `EnvironmentConfig` (with `account`, `region`, `stage`, `tablePrefix`, and `removalPolicy` fields) from `environments.ts` as a stack property.
3. THE `CDK_App` SHALL set the CDK `env` property on `SnapDatabaseStack` using the `account` and `region` values from the resolved `EnvironmentConfig`.
4. IF an unrecognised `env` context value is provided (a value that is not `dev`, `staging`, or `prod`), THEN THE `CDK_App` SHALL throw an error before synthesising any stacks, and the error message SHALL include the unrecognised value and list the three valid options.

---

### Requirement 5: Idempotent Dev Seed Script

**User Story:** As a backend developer, I want an idempotent seed script, so that I can run it multiple times against DynamoDB Local or a dev environment without creating duplicate data or failing due to existing items.

#### Acceptance Criteria

1. THE `SeedScript` SHALL seed exactly 3 dark stores with IDs `ds_lajpat_nagar` (Delhi, pincodes `110024`, `110003`, avgPickupMinutes 4), `ds_koramangala` (Bangalore, pincodes `560034`, `560095`, avgPickupMinutes 5), and `ds_bandra` (Mumbai, pincodes `400050`, `400051`, avgPickupMinutes 6).
2. THE `SeedScript` SHALL seed exactly 50 products distributed as: 15 grocery, 10 medicines, 10 snacks and beverages, 10 household, and 5 baby and personal care items, each with realistic Indian quick-commerce data (name, brand, price in paise, tags array of at least 5 terms, rekognitionLabels, barcodes).
3. THE `SeedScript` SHALL seed inventory records for every seeded product across all 6 serviceable pincodes, with 40 products having `isAvailableFor10Min: true` and `stockLevel: 50`, and 10 products having `isAvailableFor10Min: false` and `stockLevel: 0`.
4. THE `SeedScript` SHALL seed `SnapSearchIndex` rows by tokenizing each product's name, brand, and tags (lowercase, split on whitespace and punctuation, deduplicated) and writing one row per token per product to `Dev-SnapSearchIndex`.
5. THE `SeedScript` SHALL seed exactly 5 test users with IDs `test_user_new` (totalOrders: 0, smartCartTier: `trending`), `test_user_light` (totalOrders: 8, smartCartTier: `hybrid`), `test_user_regular` (totalOrders: 35, smartCartTier: `personalize`), `test_user_power` (totalOrders: 120, smartCartTier: `personalize`), and `test_user_empty` (totalOrders: 0, no addresses).
6. THE `SeedScript` SHALL seed `SnapPurchaseCadence` records for `test_user_regular` and `test_user_power`, each with at least 10 product entries where each entry has `totalPurchases >= 3`, `avgIntervalDays` between 2 and 7, and a `purchaseDates` list with at least 3 ISO 8601 UTC timestamps.
7. WHEN a record with the same primary key already exists, THE `SeedScript` SHALL skip the item without overwriting it; the preferred mechanism is `ConditionExpression: 'attribute_not_exists(#pk)'` with `ExpressionAttributeNames` mapping `#pk` to the table's actual partition key attribute name, but alternative duplicate-avoidance approaches that reliably prevent overwrites are acceptable provided no duplicate data is written.
8. THE `SeedScript` SHALL log a summary on completion using `logger.info` showing counts of inserted and skipped items per table.
9. WHEN `DYNAMODB_ENDPOINT` environment variable is set, THE `SeedScript` SHALL pass it as the DynamoDB client endpoint option, consistent with the existing `src/clients/dynamoClient.ts` pattern.
10. THE `SeedScript` SHALL store all monetary values (`price`, `mrp`) as integers in paise (no decimals).
11. THE `SeedScript` SHALL store all timestamps as ISO 8601 UTC strings (e.g., `new Date().toISOString()`).
12. THE `SeedScript` SHALL set `totalOrders >= 20` and `smartCartTier: 'personalize'` on the users receiving `SnapPurchaseCadence` records (`test_user_regular` and `test_user_power`) so their Tier-3 recommendations function correctly.

---

### Requirement 6: DynamoDB Client Singleton and Helpers

**User Story:** As a backend developer, I want a centralized DynamoDB client module, so that all service code shares one DocumentClient instance with consistent configuration, and typed helper functions replace repetitive raw SDK calls.

#### Acceptance Criteria

1. THE `DocumentClient` SHALL be created once as a module-level singleton in `src/clients/dynamoClient.ts` by extending the existing `docClient` export already in that file.
2. WHEN `DYNAMODB_ENDPOINT` environment variable is set, THE `DocumentClient` SHALL configure the DynamoDB endpoint to that value (consistent with the existing pattern in `dynamoClient.ts`).
3. THE `DynamoHelpers` SHALL export a typed `getItem<T>(tableName: string, key: Record<string, unknown>): Promise<T | null>` function that returns the unmarshalled item or `null` if not found.
4. THE `DynamoHelpers` SHALL export a typed `putItem<T extends Record<string, unknown>>(tableName: string, item: T): Promise<void>` function.
5. THE `DynamoHelpers` SHALL export a typed `updateItem(tableName: string, key: Record<string, unknown>, updateExpression: string, expressionAttributeValues: Record<string, unknown>, expressionAttributeNames?: Record<string, string>, conditionExpression?: string): Promise<void>` function, where `expressionAttributeNames` handles reserved-word attribute names.
6. THE `DynamoHelpers` SHALL export a typed `deleteItem(tableName: string, key: Record<string, unknown>): Promise<void>` function.
7. THE `DynamoHelpers` SHALL export a typed `queryItems<T>(params: { tableName: string; keyConditionExpression: string; expressionAttributeValues: Record<string, unknown>; expressionAttributeNames?: Record<string, string>; indexName?: string; limit?: number; exclusiveStartKey?: Record<string, unknown>; scanIndexForward?: boolean }): Promise<{ items: T[]; nextCursor?: string }>` function where `nextCursor` is the Base64-encoded `LastEvaluatedKey` when present.
8. THE `DynamoHelpers` SHALL export a typed `batchGetItems<T>(tableName: string, keys: Record<string, unknown>[]): Promise<T[]>` function that splits keys into groups of 100 (DynamoDB BatchGetItem limit) and merges results.
9. THE `DynamoHelpers` SHALL resolve table names using `process.env.DYNAMODB_TABLE_PREFIX || 'Dev-'` combined with the entity name, consistent with the `getTableName` helper already defined in `src/clients/dynamoClient.ts`.
10. IF a DynamoDB operation throws an error, THEN THE `DynamoHelpers` SHALL log the error using `logger.error` and re-throw it as `new AppError(ErrorCodes.DATABASE_ERROR, error.message, 500, true)`; non-DynamoDB errors (such as validation failures or network timeouts that originate outside the DynamoDB SDK) SHALL be allowed to bubble up unchanged without being wrapped in `AppError`.

---

### Requirement 7: Product Data Models

**User Story:** As a backend developer, I want typed TypeScript interfaces for product data, so that the product service and handlers are fully type-safe with no `any` usage.

#### Acceptance Criteria

1. THE `Product.ts` Model SHALL define a `Product` interface with all fields typed as follows: `productId: string`, `sku: string`, `name: string`, `brand: string`, `category: string`, `subCategory: string`, `description: string`, `imageUrls: string[]`, `price: number`, `mrp: number`, `unit: string`, `tags: string[]`, `weight: string`, `barcodes: string[]`, `rekognitionLabels: string[]`, `isAvailable: boolean`, `createdAt: string`, `updatedAt: string`.
2. THE `Product.ts` Model SHALL define a `ProductSummary` interface with fields: `productId: string`, `name: string`, `brand: string`, `category: string`, `subCategory: string`, `price: number`, `mrp: number`, `unit: string`, `imageUrls: string[]`, `tags: string[]`, `isAvailable: boolean`.
3. THE `Product.ts` Model SHALL define an `InventoryStatus` interface with fields: `productId: string`, `pincode: string`, `isAvailableFor10Min: boolean`, `stockLevel: number`, `darkStoreId: string`, `cachedAt: string` (ISO 8601 UTC).
4. THE `Product.ts` Model SHALL define a `SearchResult` interface that extends `ProductSummary` with an additional `score: number` field representing a non-negative relevance score (integer token-match count in hackathon mode, float confidence in production mode).
5. THE `Product.ts` Model SHALL define a `BarcodeResult` interface with fields: `productId: string`, `barcode: string`, `product: Product`.
6. ALL monetary fields (`price`, `mrp`) in all model interfaces SHALL be typed as `number` and documented with a JSDoc comment stating they store whole-integer paise values (no decimal component).

---

### Requirement 8: Product Service — Business Logic Functions

**User Story:** As a backend developer, I want a product service with well-defined functions, so that product retrieval, search, trending, and barcode lookup logic lives in a testable layer that has no direct dependency on Lambda event structures.

#### Acceptance Criteria

1. THE `ProductService` SHALL export a `getProductById(productId: string): Promise<Product>` function that calls `getItem` with the `SnapProducts` table name and `{ productId }` key, and throws `new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found', 404)` when the result is `null`.
2. THE `ProductService` SHALL export a `searchProducts(query: string, pincode: string, category?: string, limit?: number): Promise<SearchResult[]>` function that delegates to `searchAdapter.search(query, pincode, category, limit ?? 20)` and returns the `SearchResult[]` array from the adapter unchanged.
3. THE `ProductService` SHALL export a `getTrendingProducts(pincode: string, limit?: number): Promise<SearchResult[]>` function that first calls `cacheAdapter.get<SearchResult[]>('trending:' + pincode)`, returns the cached value on a non-null hit, and on a cache miss calls `searchAdapter.getTrending(pincode, limit ?? 10)`, writes the result to `cacheAdapter.set('trending:' + pincode, result, 900)`, then returns the result.
4. THE `ProductService` SHALL export a `getProductByBarcode(barcode: string): Promise<Product>` function that first calls `cacheAdapter.get<Product>('barcode:' + barcode)`, returns the cached product on a non-null hit, and on a cache miss calls `queryItems` on `SnapProducts` using a `BarcodeIndex` GSI (PK: `barcode`), caches the found product with `cacheAdapter.set('barcode:' + barcode, product, 3600)`, and throws `new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found', 404)` when no product is found.
5. WHEN `cacheAdapter.get` or `cacheAdapter.set` throws, THE `ProductService` SHALL catch the error, call `logger.error({ message: 'Cache error', error })`, and continue execution without propagating the cache failure.
6. THE `ProductService` SHALL import `logger` from `@utils/logger` and NEVER use `console.log`.
7. THE `ProductService` SHALL contain no function body exceeding 50 lines; helper logic SHALL be extracted to named helper functions within the same file.

---

### Requirement 9: Products Lambda Handlers

**User Story:** As a backend developer, I want Lambda handlers for the four product routes, so that API Gateway can invoke them with proper input validation, JWT-based userId extraction, standard envelope responses, and error handling.

#### Acceptance Criteria

1. THE `ProductsHandler` SHALL export a `getProduct` Lambda handler for `GET /v1/products/{productId}` that reads `productId` from `event.pathParameters`, validates it as a non-empty string using zod, calls `productService.getProductById(productId)`, and returns `response.success(product)`.
2. THE `ProductsHandler` SHALL export a `searchProductsHandler` Lambda handler for `GET /v1/products/search` that reads `q`, `pincode`, optional `category`, and optional `limit` from `event.queryStringParameters`, validates them with a zod schema (`q`: min 2 chars; `pincode`: exactly 6 digits `/^\d{6}$/`; `limit`: integer coerced from string, range 1–50), calls `productService.searchProducts`, and returns `response.success({ results, count: results.length })`.
3. THE `ProductsHandler` SHALL export a `getTrendingHandler` Lambda handler for `GET /v1/products/trending` that reads `pincode` from `event.queryStringParameters`, validates it with zod (`pincode`: exactly 6 digits `/^\d{6}$/`), calls `productService.getTrendingProducts`, and returns `response.success({ products, count: products.length })`.
4. THE `ProductsHandler` SHALL export a `getBarcodeHandler` Lambda handler for `GET /v1/products/barcode/{code}` that reads `code` from `event.pathParameters`, validates it as a non-empty string with zod, calls `productService.getProductByBarcode`, and returns `response.success(product)`.
5. WHEN zod validation fails on any handler, THE `ProductsHandler` SHALL return `response.badRequest(error.errors[0].message)` with HTTP 400 without calling any service function; a successful HTTP 2xx response SHALL NEVER be returned when validation has failed.
6. WHEN the service throws an `AppError`, THE `ProductsHandler` SHALL return `response.error(error.code, error.message, error.statusCode, error.retryable)`; the `AppError` path is entirely separate from the zod validation failure path and the two SHALL NOT share a code branch.
7. WHEN an error is thrown that is not an `AppError`, THE `ProductsHandler` SHALL call `logger.error({ message: 'Unhandled error', error, requestId, userId })` and return `response.internalError()` with HTTP 500.
8. THE `ProductsHandler` SHALL extract `userId` exclusively from `event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined` and NEVER from the request body, path parameters, or query parameters.
9. THE `ProductsHandler` SHALL include a JSDoc file header block listing all four routes, the required JWT auth, and a reference to the `Product` model schema.
10. EACH of the four handler functions SHALL contain exactly one top-level `try/catch` block and SHALL NOT exceed 40 lines of function body.

---

### Requirement 10: Unit Tests — DynamoCacheAdapter

**User Story:** As a backend developer, I want unit tests for DynamoCacheAdapter, so that its TTL validation, cache hit/miss behaviour, and error-graceful degradation are verified without calling real AWS services.

#### Acceptance Criteria

1. THE `DynamoCacheAdapter` Tests SHALL use `mockClient` from `aws-sdk-client-mock` to mock `DynamoDBDocumentClient` and reset it in `beforeEach`.
2. THE `DynamoCacheAdapter` Tests SHALL verify that `get(key)` returns a value deep-equal to the original cached input WHEN the mock returns `{ Item: { cacheKey: key, value: JSON.stringify(expected), ttl: Math.floor(Date.now()/1000) + 3600 } }`.
3. THE `DynamoCacheAdapter` Tests SHALL verify that `get(key)` returns `null` WHEN the mock returns `{ Item: { cacheKey: key, value: '...', ttl: Math.floor(Date.now()/1000) - 1 } }` (TTL in the past).
4. THE `DynamoCacheAdapter` Tests SHALL verify that `get(key)` returns `null` WHEN the mock returns `{ Item: undefined }` (key not found).
5. THE `DynamoCacheAdapter` Tests SHALL verify that `set(key, value, ttlSeconds)` calls `PutCommand` with `Item` containing `value: JSON.stringify(value)` and `ttl` within ±2 seconds of `Math.floor(Date.now()/1000) + ttlSeconds`.
6. THE `DynamoCacheAdapter` Tests SHALL verify that `del(key)` calls `DeleteCommand` with `Key: { cacheKey: key }`.
7. THE `DynamoCacheAdapter` Tests SHALL verify that `get(key)` returns `null` and does not throw WHEN the mock rejects with an error.
8. THE `DynamoCacheAdapter` Tests SHALL verify that `mget(keys)` returns an array of the same length as the input with correct hits for unexpired items and `null` for missing or expired entries.
9. THE `DynamoCacheAdapter` Tests SHALL verify that `set` and `del` do not throw WHEN the mock rejects with an error (graceful degradation).

---

### Requirement 11: Unit Tests — KeywordIntentAdapter

**User Story:** As a backend developer, I want unit tests for KeywordIntentAdapter, so that its tokenization, scoring, confidence thresholds, and graceful failure paths are verified without calling real DynamoDB.

#### Acceptance Criteria

1. THE `KeywordIntentAdapter` Tests SHALL use `mockClient` from `aws-sdk-client-mock` to mock `DynamoDBDocumentClient`, configured to return a fixed fixture of at least 3 products on `ScanCommand`, where each product fixture includes: `productId`, `sku`, `name`, `brand`, `category`, `subCategory`, `price`, `mrp`, `unit`, `imageUrls`, `tags`, `isAvailable`.
2. WHEN the query's normalized tokens form a complete subset of the tokens derived from exactly one product's `name` field, THE `KeywordIntentAdapter` Tests SHALL verify that `resolveIntent` returns a result with `confidence >= 0.75` and `alternatives` equal to an empty array `[]`.
3. WHEN the query shares at least one normalized token with two or more products but does not exclusively match any single product at high confidence, THE `KeywordIntentAdapter` Tests SHALL verify that `resolveIntent` returns a result with `0.50 <= confidence < 0.75` and an `alternatives` array of length between 1 and 2 inclusive.
4. WHEN no product in the fixture shares a normalized token with the query, THE `KeywordIntentAdapter` Tests SHALL verify that `resolveIntent` returns a result with `resolvedBy: 'none'` and a `suggestedInput` string containing the normalized query tokens joined by a space.
5. WHEN the query contains only stopwords (e.g., `"the a an"`), THE `KeywordIntentAdapter` Tests SHALL verify that `resolveIntent` returns `resolvedBy: 'none'` and `confidence: 0` without throwing.
6. WHEN the mock rejects `ScanCommand` with an error, THE `KeywordIntentAdapter` Tests SHALL verify that `resolveIntent` returns `resolvedBy: 'none'` and `confidence: 0` without throwing.

---

### Requirement 12: Unit Tests — RuleBasedRecommendationAdapter

**User Story:** As a backend developer, I want unit tests for RuleBasedRecommendationAdapter, so that all three smart-cart tiers and the in-stock filter are verified without calling real DynamoDB or the cache.

#### Acceptance Criteria

1. THE `RuleBasedRecommendationAdapter` Tests SHALL use `mockClient` from `aws-sdk-client-mock` to mock `DynamoDBDocumentClient` and use `jest.mock` to mock `cacheAdapter`, resetting both in `beforeEach`.
2. WHEN the mock returns `{ Item: { totalOrders: N } }` for `GetCommand` where N is 0, 4, or any value in between, THE `RuleBasedRecommendationAdapter` Tests SHALL verify that `getSmartCartTier` returns `"trending"`.
3. WHEN the mock returns `{ Item: { totalOrders: N } }` for `GetCommand` where N is 5, 19, or any value in between, THE `RuleBasedRecommendationAdapter` Tests SHALL verify that `getSmartCartTier` returns `"hybrid"`.
4. WHEN the mock returns `{ Item: { totalOrders: N } }` for `GetCommand` where N is 20, 120, or any value at or above 20, THE `RuleBasedRecommendationAdapter` Tests SHALL verify that `getSmartCartTier` returns `"personalize"`.
5. WHEN `cacheAdapter.mget` returns an array where every element is `null` or has `isAvailableFor10Min: false`, THE `RuleBasedRecommendationAdapter` Tests SHALL verify that `getRecommendations` returns an empty array `[]`; the test SHALL cover both the all-`null` case and the all-`isAvailableFor10Min: false` case as distinct sub-cases.
6. IF `GetCommand` rejects with an error, THEN THE `RuleBasedRecommendationAdapter` Tests SHALL verify that `getSmartCartTier` returns `"trending"` and does not throw.
7. WHEN the mock returns `{ Item: undefined }` for `GetCommand` (user not found), THE `RuleBasedRecommendationAdapter` Tests SHALL verify that `getSmartCartTier` returns `"trending"` and does not throw.

---

### Requirement 13: Unit Tests — Product Service

**User Story:** As a backend developer, I want unit tests for the product service functions, so that happy paths, not-found errors, cache interactions, and barcode lookup logic are verified in isolation.

#### Acceptance Criteria

1. THE `ProductService` Tests SHALL use `jest.mock` to mock `src/clients/dynamoClient` (specifically `getItem` and `queryItems`), `@adapters/factory` (specifically `cacheAdapter` and `searchAdapter`), resetting all mocks in `beforeEach`.
2. WHEN `getItem` resolves with a valid `Product` fixture (object containing at least `productId`, `sku`, `name`, `barcodes`), THE `ProductService` Tests SHALL verify that `getProductById` returns the same object.
3. WHEN `getItem` resolves with `null`, THE `ProductService` Tests SHALL verify that `getProductById` throws an `AppError` with `code: 'PRODUCT_NOT_FOUND'` and `statusCode: 404`.
4. WHEN `cacheAdapter.get` returns a non-null `SearchResult[]` fixture, THE `ProductService` Tests SHALL verify that `getTrendingProducts` returns the cached value without calling `searchAdapter.getTrending`.
5. WHEN `cacheAdapter.get` returns `null`, THE `ProductService` Tests SHALL verify that `getTrendingProducts` calls `searchAdapter.getTrending`, calls `cacheAdapter.set` with TTL `900`, and returns the adapter result.
6. WHEN `cacheAdapter.get` returns a non-null `Product` fixture for key `barcode:{barcode}`, THE `ProductService` Tests SHALL verify that `getProductByBarcode` returns the cached product without calling `queryItems`; the test SHALL assert the exact cache key format `'barcode:{barcode}'` (literal prefix `"barcode:"` concatenated with the barcode value).
7. WHEN `queryItems` returns an empty `items` array for the barcode lookup, THE `ProductService` Tests SHALL verify that `getProductByBarcode` throws an `AppError` with `code: 'PRODUCT_NOT_FOUND'` and `statusCode: 404`.
8. THE `ProductService` Tests SHALL verify that `searchProducts` calls `searchAdapter.search` with the provided query, pincode, category, and limit, and returns its result unchanged.
9. WHEN `cacheAdapter.get` returns `null` and `queryItems` returns a product for the barcode lookup, THE `ProductService` Tests SHALL verify that `getProductByBarcode` calls `cacheAdapter.set` with key `barcode:{barcode}` (exact key format `"barcode:"` concatenated with the barcode value), TTL `3600`, and the found product, then returns the product.
10. WHEN `getItem` resolves with a valid `Product` fixture, THE `ProductService` Tests SHALL verify that `getProductById` returns the product (cache-hit path — verifying no unnecessary DynamoDB calls for a direct-key lookup).
