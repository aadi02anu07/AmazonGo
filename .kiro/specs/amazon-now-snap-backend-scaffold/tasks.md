# Implementation Plan: Amazon Now Snap Backend Scaffold

## Overview

Implement the five-layer backend scaffold in strict dependency order: CDK infrastructure → dev seed data → DynamoDB client helpers → product service + handlers → unit and property-based tests. All code is TypeScript strict, no `any`, no `console.log`, monetary values in paise, timestamps ISO 8601 UTC. The existing adapters, logger, response formatter, and error constants must not be modified; `src/clients/dynamoClient.ts` is extended (helpers appended), never replaced.

---

## Tasks

- [x] 1. CDK Infrastructure
  - [x] 1.1 Create `cdk/config/environments.ts` with `EnvironmentConfig` interface and environment factory
    - Define `EnvironmentConfig` interface: `account`, `region`, `stage`, `tablePrefix`, `removalPolicy`
    - Implement `getEnvironmentConfig(env: string): EnvironmentConfig` — reads `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` (default `'ap-south-1'`), maps `dev → "Dev-"/DESTROY`, `staging → "Staging-"/DESTROY`, `prod → ""/RETAIN`, throws descriptive error for any other value naming the bad value and listing `['dev', 'staging', 'prod']`
    - Export `devConfig`, `stagingConfig`, `prodConfig` named constants
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 1.2 Create `cdk/constructs/SnapDynamoTable.ts` reusable L2 construct
    - Import `TableV2`, `AttributeType`, `TableEncryptionV2` from `aws-cdk-lib/aws-dynamodb`
    - Define `SnapDynamoTableProps` interface with `tableName`, `partitionKey`, optional `sortKey`, `removalPolicy`
    - In constructor: validate `env` context via `this.node.tryGetContext('env')`, throw synchronously if absent or unrecognised
    - Apply project defaults on every table: on-demand billing, PITR enabled, AWS-managed encryption, `removalPolicy` from props
    - Expose `public readonly table: TableV2` so callers can add GSIs and streams
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 1.3 Create `cdk/stacks/SnapDatabaseStack.ts` provisioning all nine tables
    - Accept `config: EnvironmentConfig` as a stack prop; apply `config.tablePrefix` to all table names and `config.removalPolicy` via `SnapDynamoTable`
    - Provision all nine tables with the exact schemas (PK/SK types, GSI names, projection types, included attributes, streams, TTL attributes) from the design:
      - `SnapUsers` — PK `userId(S)`, GSI `EmailIndex` (`email S`, ALL)
      - `SnapAddresses` — PK `userId(S)`, SK `addressId(S)`
      - `SnapProducts` — PK `productId(S)`, SK `sku(S)`, GSI `CategoryIndex` (`category S`/`subCategory S`, ALL), GSI `BrandIndex` (`brand S`/`productId S`, KEYS_ONLY), streams `NEW_AND_OLD_IMAGES`
      - `SnapInventory` — PK `pincodeProductId(S)`, GSI `PincodeIndex` (`pincode S`/`productId S`, INCLUDE `isAvailableFor10Min,stockLevel,darkStoreId`), streams `NEW_AND_OLD_IMAGES`
      - `SnapOrders` — PK `userId(S)`, SK `orderId(S)`, GSI `StatusIndex` (`status S`/`createdAt S`, INCLUDE `userId,orderId,total,pincode,darkStoreId`)
      - `SnapPurchaseCadence` — PK `userId(S)`, SK `productId(S)`, TTL attr `ttl`
      - `SnapDarkStores` — PK `darkStoreId(S)`, GSI `CityIndex` (`city S`/`darkStoreId S`, ALL)
      - `SnapCache` — PK `cacheKey(S)`, TTL attr `ttl`
      - `SnapSearchIndex` — PK `token(S)`, SK `productId(S)`, GSI `CategoryIndex` (`category S`/`token S`, ALL)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x] 1.4 Create `cdk/bin/app.ts` CDK entry point
    - Instantiate `cdk.App`, read `env` context defaulting to `"dev"`, call `getEnvironmentConfig(envName)` (throws on unrecognised value before any stack is synthesised)
    - Instantiate `SnapDatabaseStack` passing resolved config with `env: { account, region }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 1.5 Write CDK snapshot tests for `SnapDatabaseStack`
    - Use `aws-cdk-lib/assertions` `Template.fromStack` to assert all nine tables have `BillingMode: PAY_PER_REQUEST`, `PointInTimeRecoveryEnabled: true`, and the correct GSI configurations
    - Tests live in `tests/unit/cdk/SnapDatabaseStack.test.ts`
    - _Requirements: 1.2, 1.3, 1.4, 3.1–3.9_

- [x] 2. Checkpoint — CDK builds clean
  - Run `npx tsc --noEmit` over the `cdk/` tree; ensure all CDK files compile with zero errors. Ask the user if questions arise.

- [x] 3. Dev Seed Script
  - [x] 3.1 Create `scripts/seed-dev-data.ts` skeleton with imports, DynamoDB client wiring, and idempotent write helper
    - Import `docClient` from `src/clients/dynamoClient` (the existing singleton) — do **not** create a second client
    - Implement `seedItem(tableName: string, item: Record<string, unknown>, pkAttr: string)` helper that wraps `PutCommand` with `ConditionExpression: 'attribute_not_exists(#pk)'` and `ExpressionAttributeNames: { '#pk': pkAttr }`; catches `ConditionalCheckFailedException` and increments a skip counter; re-throws all other errors
    - Implement per-table counters (`inserted`, `skipped`) and a final `logger.info` summary call
    - _Requirements: 5.7, 5.8, 5.9_

  - [x] 3.2 Seed dark stores and users into `SnapDarkStores` and `SnapUsers`
    - Write exactly 3 dark stores: `ds_lajpat_nagar` (Delhi, pincodes `['110024','110003']`, avgPickupMinutes 4), `ds_koramangala` (Bangalore, `['560034','560095']`, 5), `ds_bandra` (Mumbai, `['400050','400051']`, 6)
    - Write exactly 5 users: `test_user_new` (totalOrders 0, `trending`), `test_user_light` (8, `hybrid`), `test_user_regular` (35, `personalize`), `test_user_power` (120, `personalize`), `test_user_empty` (0, no addresses)
    - All monetary values integers in paise; timestamps `new Date().toISOString()`
    - _Requirements: 5.1, 5.5, 5.10, 5.11_

  - [x] 3.3 Seed 50 products into `SnapProducts`
    - 15 grocery, 10 medicines, 10 snacks/beverages, 10 household, 5 baby/personal-care
    - Each product: realistic Indian name/brand, `price` and `mrp` as integer paise, `tags` array ≥5 terms, `rekognitionLabels`, `barcodes`
    - _Requirements: 5.2, 5.10, 5.11_

  - [x] 3.4 Seed inventory records into `SnapInventory` and search index tokens into `SnapSearchIndex`
    - Write 300 inventory rows (50 products × 6 pincodes): 40 products `isAvailableFor10Min: true`, `stockLevel: 50`; 10 products `isAvailableFor10Min: false`, `stockLevel: 0`; composite key `${pincode}#${productId}`
    - Tokenize each product's name, brand, and tags (lowercase, split on whitespace/punctuation, deduplicated) → one `(token, productId)` row per unique pair in `SnapSearchIndex`
    - _Requirements: 5.3, 5.4_

  - [x] 3.5 Seed purchase cadence records into `SnapPurchaseCadence`
    - Write ≥10 entries each for `test_user_regular` and `test_user_power`; each entry: `totalPurchases >= 3`, `avgIntervalDays` 2–7, `purchaseDates` list with ≥3 ISO 8601 UTC strings
    - _Requirements: 5.6, 5.12_

- [x] 4. Checkpoint — seed script compiles and runs idempotently
  - Run `npx tsc --noEmit` on the scripts path; ask the user to run `npm run seed:dev` twice against DynamoDB Local and confirm skip counts match on the second run. Ask the user if questions arise.

- [~] 5. DynamoDB Client Helpers
  - [x] 5.1 Append `getItem` and `putItem` helpers to `src/clients/dynamoClient.ts`
    - `getItem<T>(tableName, key): Promise<T | null>` — `GetCommand`, return `(result.Item as T) ?? null`, wrap SDK errors as `AppError(DATABASE_ERROR, ..., 500, true)` after `logger.error`
    - `putItem<T extends Record<string, unknown>>(tableName, item): Promise<void>` — `PutCommand`, same error wrapping
    - _Requirements: 6.1, 6.3, 6.4, 6.10_

  - [x] 5.2 Append `updateItem` and `deleteItem` helpers to `src/clients/dynamoClient.ts`
    - `updateItem(tableName, key, updateExpression, expressionAttributeValues, expressionAttributeNames?, conditionExpression?): Promise<void>` — `UpdateCommand`, same error wrapping
    - `deleteItem(tableName, key): Promise<void>` — `DeleteCommand`, same error wrapping
    - _Requirements: 6.5, 6.6, 6.10_

  - [x] 5.3 Append `queryItems` helper with cursor encoding to `src/clients/dynamoClient.ts`
    - `queryItems<T>(params): Promise<{ items: T[]; nextCursor?: string }>` — `QueryCommand` with all optional params forwarded; when `LastEvaluatedKey` is present: `nextCursor = Buffer.from(JSON.stringify(lek)).toString('base64')`; same error wrapping
    - _Requirements: 6.7, 6.10_

  - [ ]* 5.4 Write property test for `queryItems` cursor round-trip (Property 2)
    - **Property 2: queryItems nextCursor is a reversible Base64 encoding of LastEvaluatedKey**
    - **Validates: Requirements 6.7**
    - Use `fc.record(fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer())))` as arbitrary LEK; mock `docClient.send` to return it as `LastEvaluatedKey`; assert `JSON.parse(Buffer.from(cursor, 'base64').toString())` deep-equals the input LEK
    - Tag: `// Feature: amazon-now-snap-backend-scaffold, Property 2: queryItems nextCursor is a reversible Base64 encoding of LastEvaluatedKey`
    - `{ numRuns: 100 }`
    - _Tests file: `tests/unit/clients/dynamoHelpers.property.test.ts`_

  - [x] 5.4a Append `batchGetItems` helper with 100-key chunking to `src/clients/dynamoClient.ts`
    - `batchGetItems<T>(tableName, keys): Promise<T[]>` — chunk keys into groups of 100 via `for (let i = 0; i < keys.length; i += 100)`; `Promise.all` over chunks; merge `Responses[tableName]`; same error wrapping
    - _Requirements: 6.8, 6.10_

  - [ ]* 5.5 Write property test for `batchGetItems` call-count and key coverage (Property 3)
    - **Property 3: batchGetItems invokes BatchGetCommand exactly ceil(N/100) times**
    - **Validates: Requirements 6.8**
    - Use `fc.array(fc.record({ pk: fc.string() }), { minLength: 1, maxLength: 350 })` as arbitrary keys; mock `docClient.send` to capture call count; assert `spy.callCount === Math.ceil(keys.length / 100)` and union of all key sets equals the input set
    - Tag: `// Feature: amazon-now-snap-backend-scaffold, Property 3: batchGetItems invokes BatchGetCommand exactly ceil(N/100) times`
    - `{ numRuns: 100 }`
    - _Tests file: `tests/unit/clients/dynamoHelpers.property.test.ts`_

  - [ ]* 5.6 Write property test for DynamoDB helper error wrapping (Property 4)
    - **Property 4: DynamoDB helper errors are always wrapped as AppError DATABASE_ERROR**
    - **Validates: Requirements 6.10**
    - For each of the six helpers, mock `docClient.send` to reject with `fc.string()` message; assert the re-thrown error is `instanceof AppError` with `code === ErrorCodes.DATABASE_ERROR`, `statusCode === 500`, `retryable === true`
    - Tag: `// Feature: amazon-now-snap-backend-scaffold, Property 4: DynamoDB helper errors are always wrapped as AppError DATABASE_ERROR`
    - `{ numRuns: 100 }`
    - _Tests file: `tests/unit/clients/dynamoHelpers.property.test.ts`_

- [x] 6. Checkpoint — helpers compile and properties pass
  - Run `npx tsc --noEmit`; run `npx jest tests/unit/clients --run` to confirm property tests pass. Ask the user if questions arise.

- [x] 7. Product Models and Service
  - [x] 7.1 Create `src/models/Product.ts` with all five typed interfaces
    - `Product` — 18 fields exactly as specified; JSDoc on `price` and `mrp` stating whole-integer paise
    - `ProductSummary` — 11 fields; JSDoc on `price` and `mrp`
    - `InventoryStatus` — 6 fields; `cachedAt: string` (ISO 8601 UTC)
    - `SearchResult extends ProductSummary` — adds `score: number` (non-negative)
    - `BarcodeResult` — `{ productId, barcode, product: Product }`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 7.2 Create `src/services/ProductService.ts` with `getProductById` and `searchProducts`
    - `getProductById(productId: string): Promise<Product>` — calls `getItem<Product>(TABLE_NAMES.PRODUCTS, { productId })`; null → `throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found', 404)`
    - `searchProducts(query, pincode, category?, limit?): Promise<SearchResult[]>` — delegates to `searchAdapter.search(query, pincode, category, limit ?? 20)`, returns result unchanged
    - No `console.log`; import `logger` from `@utils/logger`
    - _Requirements: 8.1, 8.2, 8.6_

  - [x] 7.3 Add `getTrendingProducts` and `getProductByBarcode` to `src/services/ProductService.ts`
    - Extract shared `withCache<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T>` private helper to keep each public function ≤50 lines; cache errors silently swallowed via `logger.error`
    - `getTrendingProducts(pincode, limit?)`: cache key `'trending:' + pincode`, TTL 900, loader → `searchAdapter.getTrending(pincode, limit ?? 10)`
    - `getProductByBarcode(barcode)`: cache key `'barcode:' + barcode`, TTL 3600, loader → `queryItems` on `SnapProducts` using `BarcodeIndex` GSI; not found → `throw AppError(PRODUCT_NOT_FOUND, 404)`
    - _Requirements: 8.3, 8.4, 8.5, 8.7_

  - [ ]* 7.4 Write property test that `searchProducts` returns the adapter's result unchanged (Property 5)
    - **Property 5: searchProducts returns the adapter's result unchanged**
    - **Validates: Requirements 8.2**
    - Use `fc.array(fc.record({ productId: fc.string(), score: fc.nat() }), { maxLength: 50 })` as arbitrary result; mock `searchAdapter.search` to resolve with it; assert returned array deep-equals the mock value
    - Tag: `// Feature: amazon-now-snap-backend-scaffold, Property 5: searchProducts returns the adapter's result unchanged`
    - `{ numRuns: 100 }`
    - _Tests file: `tests/unit/services/ProductService.property.test.ts`_

  - [ ]* 7.5 Write property test that cache errors in ProductService are silently swallowed (Property 6)
    - **Property 6: Cache errors in ProductService are silently swallowed**
    - **Validates: Requirements 8.5**
    - For `getTrendingProducts`: mock `cacheAdapter.get` to throw `fc.string()` message; assert function resolves (not rejects) and `searchAdapter.getTrending` was called
    - For `getProductByBarcode`: mock `cacheAdapter.set` to throw; assert function resolves with the product (not rejects)
    - Tag: `// Feature: amazon-now-snap-backend-scaffold, Property 6: Cache errors in ProductService are silently swallowed`
    - `{ numRuns: 100 }`
    - _Tests file: `tests/unit/services/ProductService.property.test.ts`_

- [x] 8. Products Lambda Handlers
  - [x] 8.1 Create `src/handlers/products.ts` with `getProduct` and `searchProductsHandler`
    - File-level JSDoc listing all four routes, required JWT auth, and `Product` model schema reference
    - `getProduct`: path param `productId`, zod `z.object({ productId: z.string().min(1) })`, calls `getProductById`, returns `response.success(product)`
    - `searchProductsHandler`: query params `q/pincode/category?/limit?`, zod schema as specified (`q` min 2, `pincode` `/^\d{6}$/`, `limit` coerced int 1–50), calls `searchProducts`, returns `response.success({ results, count })`
    - Both handlers: extract `userId` from `event.requestContext.authorizer?.jwt?.claims?.sub` only; exactly one top-level `try/catch`; ≤40 lines each; zod failure → `response.badRequest(error.errors[0].message)` before try block; `AppError` → `response.error(...)`; unknown → `logger.error + response.internalError()`
    - _Requirements: 9.1, 9.2, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [x] 8.2 Add `getTrendingHandler` and `getBarcodeHandler` to `src/handlers/products.ts`
    - `getTrendingHandler`: query param `pincode`, zod `z.object({ pincode: z.string().regex(/^\d{6}$/) })`, calls `getTrendingProducts`, returns `response.success({ products, count })`
    - `getBarcodeHandler`: path param `code`, zod `z.object({ code: z.string().min(1) })`, calls `getProductByBarcode`, returns `response.success(product)`
    - Same structural constraints (≤40 lines, one try/catch, JWT userId, zod gate before try)
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.10_

  - [ ]* 8.3 Write property test that validation-failing inputs never reach the service layer (Property 7)
    - **Property 7: Validation-failing inputs never reach the service layer**
    - **Validates: Requirements 9.5**
    - Use `fc.string()` filtered to ≠ 6-digit pattern for pincode; `fc.string({ maxLength: 1 })` for `q`; `fc.integer({ min: 51 })` for limit; mock all service functions; assert HTTP 400 returned and no service mock was called
    - Tag: `// Feature: amazon-now-snap-backend-scaffold, Property 7: Validation-failing inputs never reach the service layer`
    - `{ numRuns: 100 }`
    - _Tests file: `tests/unit/handlers/products.property.test.ts`_

  - [ ]* 8.4 Write property test that userId is always taken from JWT claims only (Property 8)
    - **Property 8: userId is always taken from JWT claims, never from other event fields**
    - **Validates: Requirements 9.8**
    - Build synthetic events with `fc.string()` userId planted in body, path params, and query string; set a different value in `event.requestContext.authorizer.jwt.claims.sub`; invoke each handler; capture the `userId` passed to `logger.error` (spy); assert it equals the JWT claims value in all cases
    - Tag: `// Feature: amazon-now-snap-backend-scaffold, Property 8: userId is always taken from JWT claims, never from other event fields`
    - `{ numRuns: 100 }`
    - _Tests file: `tests/unit/handlers/products.property.test.ts`_

- [x] 9. Checkpoint — service and handler compile and pass handlers property tests
  - Run `npx tsc --noEmit`; run `npx jest tests/unit/handlers tests/unit/services --run`. Ask the user if questions arise.

- [x] 10. Unit Tests — Adapter Suite
  - [x] 10.1 Write unit tests for `DynamoCacheAdapter` in `tests/unit/adapters/DynamoCacheAdapter.test.ts`
    - Use `mockClient(DynamoDBDocumentClient)`; `beforeEach(() => mock.reset())`
    - Cover all 9 scenarios from the design: fresh hit, expired TTL, key missing, SDK throws on get, set happy path (PutCommand args incl. `value: JSON.stringify(v)` and ttl within ±2s), set SDK throws, del happy path (DeleteCommand with `Key: { cacheKey }`), del SDK throws, mget mixed hits/misses
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [x] 10.2 Write unit tests for `KeywordIntentAdapter` in `tests/unit/adapters/KeywordIntentAdapter.test.ts`
    - Use `mockClient(DynamoDBDocumentClient)` returning ≥3 product fixtures on `ScanCommand`
    - Cover all 5 scenarios: high confidence (`>= 0.75`, `alternatives: []`), medium confidence (`0.50–0.74`, `alternatives.length 1–2`), no match (`resolvedBy: 'none'`, `suggestedInput` = joined tokens), all-stopwords input, SDK throws
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 10.3 Write unit tests for `RuleBasedRecommendationAdapter` in `tests/unit/adapters/RuleBasedRecommendationAdapter.test.ts`
    - Use `mockClient(DynamoDBDocumentClient)` + `jest.mock('@adapters/factory')` for `cacheAdapter`; reset both in `beforeEach`
    - Tier boundaries: `totalOrders` 0 and 4 → `"trending"`; 5 and 19 → `"hybrid"`; 20 and 120 → `"personalize"`
    - `getRecommendations`: all-null mget → `[]`; all `isAvailableFor10Min: false` → `[]`
    - Error and user-not-found paths both return `"trending"` without throw
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [x] 11. Unit Tests — ProductService Suite
  - [x] 11.1 Write unit tests for `ProductService` in `tests/unit/services/ProductService.test.ts`
    - `jest.mock('@clients/dynamoClient', () => ({ getItem: jest.fn(), queryItems: jest.fn(), TABLE_NAMES: { PRODUCTS: 'Dev-SnapProducts' } }))`
    - `jest.mock('@adapters/factory', () => ({ searchAdapter: { search: jest.fn(), getTrending: jest.fn() }, cacheAdapter: { get: jest.fn(), set: jest.fn() } }))`
    - `beforeEach(() => jest.clearAllMocks())`
    - Cover all 10 scenarios: `getProductById` found/not-found, `searchProducts` delegates unchanged, `getTrendingProducts` cache hit / cache miss (verifies `getTrending` + `set(900)`), `getProductByBarcode` cache hit / cache miss found (verifies `set('barcode:X', product, 3600)`) / cache miss not-found, cache-get throws (error swallowed), cache-set throws (product returned)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

- [x] 12. Property-Based Test — Environment Config (Property 1)
  - [x] 12.1 Write property test for `getEnvironmentConfig` in `tests/unit/cdk/environments.property.test.ts`
    - **Property 1: Environment config throws on any unrecognised env value**
    - **Validates: Requirements 2.7, 1.7**
    - Use `fc.string().filter(s => !['dev','staging','prod'].includes(s))` as arbitrary invalid env; assert `getEnvironmentConfig(s)` throws and error message contains both the invalid value and at least one of `'dev'`, `'staging'`, `'prod'`
    - Tag: `// Feature: amazon-now-snap-backend-scaffold, Property 1: Environment config throws on any unrecognised env value`
    - `{ numRuns: 100 }`

- [x] 13. Final Checkpoint — full test suite green
  - Run `npx tsc --noEmit` across the entire project; run `npx jest --run` (all test files) and confirm all tests pass with ≥80% coverage on branches, functions, lines, and statements. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for an MVP run
- Tasks 5.4 and 5.4a share a decimal number by design — 5.4 is the PBT sub-task and 5.4a is the implementation sub-task so the PBT is placed close to the implementation it validates
- All property tests require `fast-check` (`npm install --save-dev fast-check`) — add it before running properties
- `fast-check` is not yet in `package.json`; add it as the first action before running any PBT task
- The existing `src/clients/dynamoClient.ts` is **extended** (helpers appended below the existing `TABLE_NAMES` block); the singleton `docClient` and all existing exports are preserved
- The seed script imports the **existing** `docClient` singleton, not a fresh client
- CDK files live under `cdk/` (not `src/`), consistent with the `tsconfig.json` `include` array
- `scripts/seed-dev-data.ts` is invoked via `npm run seed:dev` (already wired in `package.json`)
- Test files follow the pattern `tests/unit/{layer}/*.test.ts` (Jest roots: `src`, `tests`)
- Each property test file must have `{ numRuns: 100 }` explicitly set on every `fc.assert` call
- No handler body may exceed 40 lines; no service function body may exceed 50 lines — extract helpers as needed

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4", "1.5"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3"] },
    { "id": 6, "tasks": ["3.4", "3.5"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2"] },
    { "id": 9, "tasks": ["5.3", "5.4a"] },
    { "id": 10, "tasks": ["5.4", "5.5", "5.6"] },
    { "id": 11, "tasks": ["7.1"] },
    { "id": 12, "tasks": ["7.2"] },
    { "id": 13, "tasks": ["7.3"] },
    { "id": 14, "tasks": ["7.4", "7.5", "8.1"] },
    { "id": 15, "tasks": ["8.2"] },
    { "id": 16, "tasks": ["8.3", "8.4", "10.1", "10.2", "10.3", "12.1"] },
    { "id": 17, "tasks": ["11.1"] }
  ]
}
```
