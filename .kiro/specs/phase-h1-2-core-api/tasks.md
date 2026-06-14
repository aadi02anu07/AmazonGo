# Implementation Plan: Phase H1.2 - Core API Implementation

## Overview

This document breaks down Phase H1.2 requirements into specific implementation tasks organized by service in dependency order. Each task includes:
- Clear description and scope
- Dependencies on other tasks
- Acceptance criteria for verification
- Estimated effort in hours
- Tags for categorization

Services must be implemented in strict dependency order:
1. Products Service (no dependencies)
2. Inventory Service (depends on Products)
3. ETA Service (depends on Inventory)
4. Intent Service (depends on Products)
5. Smart Cart Service (depends on Inventory)
6. Orders Service (depends on Inventory and ETA)
7. Cross-cutting concerns (parallel with services)

## Tasks

This phase implements 64 implementation tasks across 7 phases, delivering 6 core microservices (Products, Inventory, ETA, Intent, Smart Cart, Orders) with comprehensive test coverage and documentation.

**Total Estimated Effort**: 130-150 hours

**Key Deliverables**:
- 6 fully implemented REST API services
- 30+ API endpoints with JWT authentication
- Comprehensive unit and integration test suites (>80% coverage)
- Complete API documentation
- Error handling and logging infrastructure
- Adapter pattern for production service transitions

## Notes

**Implementation Strategy**:
- Services implemented in strict dependency order to maximize parallel testing
- All services use DynamoDB adapters in H1.2 (Hackathon Mode)
- Adapter factory pattern enables seamless transition to production AI/ML services via configuration flags
- Test-driven development approach with unit and integration tests for each service
- Each service includes model definition → business logic → API handler → comprehensive tests

**Technology Stack**:
- Language: TypeScript
- Runtime: AWS Lambda
- Database: DynamoDB (with Local for testing)
- Testing: Jest with property-based testing framework
- Validation: Zod schemas
- API Gateway: AWS Lambda with JWT Authorizer

**Performance Targets**:
- Single-item lookups: P50 < 50ms, P99 < 150ms
- Search operations: P50 < 200ms, P99 < 600ms
- Order placement: P50 < 500ms, P99 < 1200ms

**Security Requirements**:
- All endpoints require valid JWT from Cognito User Pool
- User isolation: cross-user access returns 404 (not 403)
- Input validation: Zod schemas validate all request parameters
- Error messages: 5xx errors return generic messages (no internal details)
- Logging: No PII or sensitive data in logs

**Concurrency Handling**:
- DynamoDB conditional writes prevent race conditions on soft-reserve
- Cache invalidation ensures eventual consistency
- 90-second soft-reserve window with automatic cleanup

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "title": "Foundation & Setup",
      "tasks": ["0.1"]
    },
    {
      "title": "Products Service",
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"]
    },
    {
      "title": "Inventory Service",
      "dependsOn": ["1.5"],
      "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5"]
    },
    {
      "title": "ETA Service",
      "dependsOn": ["2.5"],
      "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5"]
    },
    {
      "title": "Intent Service",
      "dependsOn": ["1.5"],
      "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5"]
    },
    {
      "title": "Smart Cart Service",
      "dependsOn": ["2.5"],
      "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5"]
    },
    {
      "title": "Orders Service",
      "dependsOn": ["3.5", "5.5"],
      "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5"]
    },
    {
      "title": "Cross-Cutting Concerns",
      "dependsOn": ["6.5"],
      "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10"]
    }
  ]
}
```

---

## Phase 0: Foundation & Setup

### 0.1 Setup Testing Framework and Error Utilities

- **Status**: completed
- **Dependencies**: None
- **Tags**: setup, infrastructure, utilities
- **Estimated Hours**: 4

**Description**:
Set up Jest testing framework, create error handling utilities, define error codes, and create test fixtures/mocks that will be used across all services.

**Sub-tasks**:
- 0.1.1 Configure Jest for TypeScript
- 0.1.2 Create error code definitions (constants/errors.ts)
- 0.1.3 Create AppError base class and error factory
- 0.1.4 Create test fixtures and mock builders
- 0.1.5 Create response envelope utility
- 0.1.6 Verify setup with smoke test

**Acceptance Criteria**:
- [x] Jest configuration is complete and runs without errors
- [x] All error codes from requirements are defined in constants/errors.ts
- [x] AppError class can be thrown with code, message, and statusCode
- [x] Test fixtures provide builders for Product, Inventory, Order, User models
- [x] Response utility generates correct envelope format (success/error)
- [x] Mock adapters (SearchAdapter, IntentAdapter, RecommendationAdapter) are implemented
- [x] Smoke test passes (can create and throw AppError, generate responses)

---

## Phase 1: Products Service

The Products Service provides product catalog management with multiple lookup methods (ID, barcode, search, trending).

### 1.1 Create Product Model and Types

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: model, types, products
- **Estimated Hours**: 2

**Description**:
Define TypeScript interfaces and types for Product, SearchResult, and related models. Include validation schemas using Zod.

**Sub-tasks**:
- 1.1.1 Define Product interface with all fields
- 1.1.2 Define SearchResult interface
- 1.1.3 Create Zod validation schemas
- 1.1.4 Create type exports

**Acceptance Criteria**:
- [x] Product interface has all required fields (productId, sku, name, brand, category, description, imageUrls, price in paise, etc.)
- [x] Validation schemas validate pincode (6 digits), productId (UUID), search query (max 200 chars, non-empty)
- [x] Types can be imported and used across the application
- [x] Zod schemas reject invalid inputs (wrong format, length violations)

---

### 1.2 Create ProductsService Implementation

- **Status**: completed
- **Dependencies**: 1.1, 0.1
- **Tags**: service, products, business-logic
- **Estimated Hours**: 6

**Description**:
Implement ProductsService with methods for getting products by ID, barcode, searching, and retrieving trending products. Include cache integration (DynamoDB cache adapter) with proper TTLs.

**Sub-tasks**:
- 1.2.1 Implement getProductById with cache (1 hour TTL: `product:{productId}`)
- 1.2.2 Implement getProductByBarcode with cache (1 hour TTL: `barcode:{barcodeValue}`)
- 1.2.3 Implement getTrendingProducts with cache (15 min TTL: `trending:{pincode}`)
- 1.2.4 Implement searchProducts using SearchAdapter
- 1.2.5 Add cache invalidation logic (product updates clear related cache keys)
- 1.2.6 Add error handling for all methods

**Acceptance Criteria**:
- [x] getProductById returns Product or throws PRODUCT_NOT_FOUND (404)
- [x] getProductByBarcode returns Product or throws BARCODE_NOT_FOUND (404)
- [x] getTrendingProducts returns array of Products or empty array
- [x] searchProducts returns array of SearchResults ranked by relevance
- [x] Cache is populated after successful retrieval with correct TTLs
- [x] Cache is checked before database query (fast path)
- [x] All methods have proper error handling and logging
- [x] barcode and product lookups work with correct cache keys

---

### 1.3 Create Products API Handler (Lambda)

- **Status**: completed
- **Dependencies**: 1.2
- **Tags**: handler, api, products
- **Estimated Hours**: 4

**Description**:
Create Lambda handler for Products routes. Handles request parsing, validation, JWT auth, and response formatting.

**Sub-tasks**:
- 1.3.1 Implement GET /v1/products/{id} handler
- 1.3.2 Implement GET /v1/products/barcode/{code} handler
- 1.3.3 Implement GET /v1/products/trending handler with pincode validation
- 1.3.4 Implement GET /v1/products/search handler with query and pincode validation
- 1.3.5 Add input validation (pincode format, query length)
- 1.3.6 Add response envelope formatting

**Acceptance Criteria**:
- [x] GET /v1/products/{id} returns 200 with product or 404 with PRODUCT_NOT_FOUND
- [x] GET /v1/products/barcode/{code} returns 200 with product or 404 with BARCODE_NOT_FOUND
- [x] GET /v1/products/trending requires valid 6-digit pincode, returns 200 or 400 for invalid pincode
- [x] GET /v1/products/search requires non-empty query (max 200 chars) and valid pincode
- [x] All responses include requestId and timestamp
- [x] Invalid inputs return 400 with INVALID_REQUEST error
- [x] All routes check JWT token validity (return 401 if missing/expired)

---

### 1.4 Write Products Service Unit Tests

- **Status**: completed
- **Dependencies**: 1.2
- **Tags**: test, unit, products
- **Estimated Hours**: 4

**Description**:
Write unit tests for ProductsService with mocked cache and search adapters.

**Sub-tasks**:
- 1.4.1 Test getProductById: success, not found, cache hit/miss
- 1.4.2 Test getProductByBarcode: success, not found, cache hit/miss
- 1.4.3 Test getTrendingProducts: with results, empty results, cache scenarios
- 1.4.4 Test searchProducts: with results, no results, adapter error
- 1.4.5 Test cache invalidation scenarios
- 1.4.6 Test error handling for all methods

**Acceptance Criteria**:
- [x] All test cases pass
- [x] Mocked dependencies correctly substituted (cache, SearchAdapter)
- [x] Cache logic verified (TTL set correctly, key format correct)
- [x] Error cases throw AppError with correct code and status
- [x] Unit test coverage > 90% for ProductsService

---

### 1.5 Write Products API Integration Tests

- **Status**: completed
- **Dependencies**: 1.3, 1.4
- **Tags**: test, integration, products
- **Estimated Hours**: 4

**Description**:
Write integration tests for Products routes with DynamoDB Local and real adapter implementations.

**Sub-tasks**:
- 1.5.1 Setup DynamoDB Local for integration tests
- 1.5.2 Seed test data (50 products, barcode mappings)
- 1.5.3 Test GET /v1/products/{id} end-to-end
- 1.5.4 Test GET /v1/products/barcode/{code} end-to-end
- 1.5.5 Test GET /v1/products/trending end-to-end
- 1.5.6 Test GET /v1/products/search end-to-end
- 1.5.7 Test error scenarios and response format

**Acceptance Criteria**:
- [x] All routes return correct HTTP status codes
- [x] All responses follow standard envelope format
- [x] DynamoDB Local integration works correctly
- [x] Test data is seeded and available for queries
- [x] Invalid parameters return 400 with detailed error info
- [x] Missing JWT returns 401
- [x] All tests pass

---

## Phase 2: Inventory Service

The Inventory Service manages stock levels with soft-reserve capability for checkout flow.

### 2.1 Create Inventory Model and Types

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: model, types, inventory
- **Estimated Hours**: 2

**Description**:
Define TypeScript interfaces for InventoryRecord, InventoryStatus, and related models. Include Zod validation schemas.

**Sub-tasks**:
- 2.1.1 Define InventoryRecord interface
- 2.1.2 Define InventoryStatus interface
- 2.1.3 Define ReservationRecord interface
- 2.1.4 Create Zod validation schemas
- 2.1.5 Create type exports

**Acceptance Criteria**:
- [x] InventoryRecord has fields: pincodeProductId, pincode, productId, darkStoreId, stockLevel, isAvailableFor10Min, reservedUnits, reservationExpiresAt
- [x] InventoryStatus has fields: productId, pincode, isAvailableFor10Min, stockLevel, darkStoreId
- [x] Validation schemas validate pincode, productId, quantity (1-99)
- [x] Types compile and export correctly

---

### 2.2 Create InventoryService Implementation

- **Status**: completed
- **Dependencies**: 2.1, 0.1
- **Tags**: service, inventory, business-logic
- **Estimated Hours**: 8

**Description**:
Implement InventoryService with stock checking, batch checking, and soft-reserve capability with 90-second expiration.

**Sub-tasks**:
- 2.2.1 Implement checkStock with cache (30-second TTL: `inv:{pincode}:{productId}`)
- 2.2.2 Implement batchCheckStock (parallel checkStock calls)
- 2.2.3 Implement softReserve with conditional write
- 2.2.4 Implement releaseReservation logic
- 2.2.5 Implement reservation expiry cleanup (scheduled)
- 2.2.6 Implement cache invalidation on stock updates
- 2.2.7 Add comprehensive error handling

**Acceptance Criteria**:
- [x] checkStock returns InventoryStatus or throws OUT_OF_STOCK/STOCK_CHECK_FAILED
- [x] batchCheckStock returns array of InventoryStatus objects
- [x] softReserve uses DynamoDB conditional write: `stockLevel > reservedUnits`
- [x] softReserve throws RESERVATION_FAILED on conditional write failure
- [x] Reservations expire after 90 seconds (TTL or scheduled cleanup)
- [x] releaseReservation decrements reservedUnits
- [x] Cache is checked before DynamoDB (cache hit returns within 30s TTL)
- [x] Invalid quantity (< 1 or > 99) throws INVALID_QUANTITY (400)
- [x] DynamoDB unavailability returns STOCK_CHECK_FAILED (500)

---

### 2.3 Create Inventory API Handler (Lambda)

- **Status**: completed
- **Dependencies**: 2.2
- **Tags**: handler, api, inventory
- **Estimated Hours**: 3

**Description**:
Create Lambda handler for Inventory routes.

**Sub-tasks**:
- 2.3.1 Implement GET /v1/inventory/{pincode}/{productId} handler
- 2.3.2 Implement POST /v1/inventory/batch-check handler
- 2.3.3 Add input validation (pincode format, productId format, quantity validation)
- 2.3.4 Add response envelope formatting

**Acceptance Criteria**:
- [x] GET /v1/inventory/{pincode}/{productId} returns 200 with InventoryStatus or 422 with OUT_OF_STOCK
- [x] POST /v1/inventory/batch-check returns 200 with array of InventoryStatus
- [x] Invalid pincode returns 400 with INVALID_PINCODE
- [x] Invalid productId returns 400 with INVALID_REQUEST
- [x] All responses include requestId and timestamp
- [x] JWT validation passes (401 if missing/invalid)

---

### 2.4 Write Inventory Service Unit Tests

- **Status**: completed
- **Dependencies**: 2.2
- **Tags**: test, unit, inventory
- **Estimated Hours**: 5

**Description**:
Write unit tests for InventoryService with mocked DynamoDB and cache.

**Sub-tasks**:
- 2.4.1 Test checkStock: success, out of stock, cache scenarios
- 2.4.2 Test batchCheckStock: mixed availability
- 2.4.3 Test softReserve: success, conditional write failure
- 2.4.4 Test releaseReservation
- 2.4.5 Test reservation expiry logic
- 2.4.6 Test error handling and edge cases

**Acceptance Criteria**:
- [x] All test cases pass
- [x] softReserve conditional write logic verified (prevents overselling)
- [x] Cache behavior correct (30-second TTL)
- [x] Error scenarios throw correct codes and status
- [x] Unit test coverage > 90% for InventoryService

---

### 2.5 Write Inventory API Integration Tests

- **Status**: completed
- **Dependencies**: 2.3, 2.4
- **Tags**: test, integration, inventory
- **Estimated Hours**: 4

**Description**:
Write integration tests for Inventory routes with DynamoDB Local.

**Sub-tasks**:
- 2.5.1 Setup test data (inventory records for 3 pincodes, 10 products)
- 2.5.2 Test GET /v1/inventory end-to-end
- 2.5.3 Test POST /v1/inventory/batch-check end-to-end
- 2.5.4 Test soft-reserve success scenario
- 2.5.5 Test soft-reserve failure (out of stock)
- 2.5.6 Test error scenarios

**Acceptance Criteria**:
- [x] All routes return correct HTTP status codes
- [x] Soft-reserve conditional write works (only one concurrent request succeeds)
- [x] Cache integration works (repeated requests within 30s return faster)
- [x] All tests pass with DynamoDB Local

---

## Phase 3: ETA Service

The ETA Service calculates delivery time estimates based on dark store configuration and last-mile distance.

### 3.1 Create ETA Model and Types

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: model, types, eta
- **Estimated Hours**: 2

**Description**:
Define TypeScript interfaces for ETAResult, DarkStore, and related models.

**Sub-tasks**:
- 3.1.1 Define ETAResult interface
- 3.1.2 Define DarkStore interface
- 3.1.3 Create Zod validation schemas
- 3.1.4 Create type exports

**Acceptance Criteria**:
- [x] ETAResult has fields: etaMinutes, etaAt (ISO 8601), darkStoreId, label
- [x] DarkStore has fields: darkStoreId, name, city, latitude, longitude, serviceablePincodes, avgPickupMinutes, isOperational, operatingHours
- [x] Validation schemas work correctly

---

### 3.2 Create ETAService Implementation

- **Status**: completed
- **Dependencies**: 3.1, 0.1, 2.2
- **Tags**: service, eta, business-logic
- **Estimated Hours**: 6

**Description**:
Implement ETAService with ETA calculation logic based on dark store configuration and pincode servicability.

**Sub-tasks**:
- 3.2.1 Implement calculateETA with pincode validation
- 3.2.2 Implement dark store lookup (select shortest avgPickupMinutes if multiple serve pincode)
- 3.2.3 Implement last-mile delivery estimate calculation
- 3.2.4 Implement batch calculateETA
- 3.2.5 Implement cache with 60-second TTL: `eta:{pincode}:{darkStoreId}`
- 3.2.6 Add error handling for non-serviceable pincodes, offline stores

**Acceptance Criteria**:
- [x] calculateETA returns ETAResult with etaMinutes and etaAt (ISO 8601)
- [x] Non-serviceable pincode throws PINCODE_NOT_SERVICEABLE (422)
- [x] Offline dark store throws DARKSTORE_OFFLINE (503)
- [x] Multiple dark stores: select one with shortest avgPickupMinutes
- [x] Cache is used (60-second TTL)
- [x] batchCalculateETA returns array of ETAResults
- [x] Missing dark store config throws ETA_CALCULATION_FAILED (500)

---

### 3.3 Create ETA API Handler (Lambda)

- **Status**: completed
- **Dependencies**: 3.2
- **Tags**: handler, api, eta
- **Estimated Hours**: 2

**Description**:
Create Lambda handler for ETA routes.

**Sub-tasks**:
- 3.3.1 Implement GET /v1/eta handler
- 3.3.2 Implement POST /v1/eta/batch handler
- 3.3.3 Add input validation
- 3.3.4 Add response envelope formatting

**Acceptance Criteria**:
- [x] GET /v1/eta returns 200 with ETAResult or 422/503 for error cases
- [x] POST /v1/eta/batch returns 200 with array of ETAResults
- [x] All responses include requestId and timestamp
- [x] JWT validation passes

---

### 3.4 Write ETA Service Unit Tests

- **Status**: completed
- **Dependencies**: 3.2
- **Tags**: test, unit, eta
- **Estimated Hours**: 3

**Description**:
Write unit tests for ETAService.

**Sub-tasks**:
- 3.4.1 Test calculateETA: success, non-serviceable pincode, offline store
- 3.4.2 Test batch calculateETA
- 3.4.3 Test cache behavior
- 3.4.4 Test dark store selection (multiple stores serving pincode)

**Acceptance Criteria**:
- [x] All test cases pass
- [x] Error scenarios throw correct codes
- [x] Unit test coverage > 90%

---

### 3.5 Write ETA API Integration Tests

- **Status**: completed
- **Dependencies**: 3.3, 3.4
- **Tags**: test, integration, eta
- **Estimated Hours**: 3

**Description**:
Write integration tests for ETA routes.

**Sub-tasks**:
- 3.5.1 Setup test data (3 dark stores, service config)
- 3.5.2 Test GET /v1/eta end-to-end
- 3.5.3 Test POST /v1/eta/batch end-to-end
- 3.5.4 Test error scenarios

**Acceptance Criteria**:
- [x] All routes work end-to-end
- [x] Cache integration verified
- [x] All tests pass

---

## Phase 4: Intent Service

The Intent Service resolves user intent from text or voice input to product recommendations.

### 4.1 Create Intent Model and Types

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: model, types, intent
- **Estimated Hours**: 2

**Description**:
Define TypeScript interfaces for IntentResult, IntentRequest, and related models.

**Sub-tasks**:
- 4.1.1 Define IntentResult interface
- 4.1.2 Define IntentRequest interface
- 4.1.3 Create Zod validation schemas
- 4.1.4 Create type exports

**Acceptance Criteria**:
- [x] IntentResult has fields: productId, name, brand, price (paise), imageUrl, confidence (0-1), reason, resolvedBy, alternatives[], suggestedInput
- [x] Validation schemas validate transcript (non-empty, max length)
- [x] Types compile correctly

---

### 4.2 Create IntentService Implementation

- **Status**: completed
- **Dependencies**: 4.1, 0.1, 1.2
- **Tags**: service, intent, business-logic
- **Estimated Hours**: 8

**Description**:
Implement IntentService with confidence-based product resolution using IntentAdapter and SearchAdapter.

**Sub-tasks**:
- 4.2.1 Implement resolveTextIntent with empty transcript validation
- 4.2.2 Implement resolveVoiceIntent with empty transcript validation
- 4.2.3 Implement confidence scoring (normalize text, match against product data)
- 4.2.4 Implement confidence tier logic:
  - ≥ 0.75: single product, no alternatives
  - 0.50-0.74: single product + up to 2 alternatives
  - < 0.50: graceful failure (resolvedBy: 'none', suggestedInput)
- 4.2.5 Implement integration with IntentAdapter
- 4.2.6 Implement integration with SearchAdapter
- 4.2.7 Add error handling

**Acceptance Criteria**:
- [x] resolveTextIntent returns IntentResult or throws EMPTY_TRANSCRIPT (400)
- [x] resolveVoiceIntent returns IntentResult or throws EMPTY_TRANSCRIPT (400)
- [x] Confidence ≥ 0.75 returns single product with no alternatives
- [x] Confidence 0.50-0.74 returns product + alternatives array (max 2)
- [x] Confidence < 0.50 returns resolvedBy: 'none' with suggestedInput
- [x] IntentResult includes reason explanation
- [x] Error handling: INTENT_RESOLUTION_FAILED (500) on adapter error
- [x] All test cases validate confidence scoring logic

---

### 4.3 Create Intent API Handler (Lambda)

- **Status**: completed
- **Dependencies**: 4.2
- **Tags**: handler, api, intent
- **Estimated Hours**: 2

**Description**:
Create Lambda handler for Intent routes.

**Sub-tasks**:
- 4.3.1 Implement POST /v1/intent/text handler
- 4.3.2 Implement POST /v1/intent/voice handler
- 4.3.3 Add input validation (non-empty transcript)
- 4.3.4 Add response envelope formatting

**Acceptance Criteria**:
- [x] POST /v1/intent/text returns 200 with IntentResult or 400 for empty transcript
- [x] POST /v1/intent/voice returns 200 with IntentResult or 400 for empty transcript
- [x] All responses include requestId and timestamp
- [x] JWT validation passes (401 if missing/invalid)

---

### 4.4 Write Intent Service Unit Tests

- **Status**: completed
- **Dependencies**: 4.2
- **Tags**: test, unit, intent
- **Estimated Hours**: 5

**Description**:
Write unit tests for IntentService with mocked adapters.

**Sub-tasks**:
- 4.4.1 Test resolveTextIntent: high confidence, medium confidence, low confidence
- 4.4.2 Test resolveVoiceIntent: same confidence tiers
- 4.4.3 Test empty/whitespace-only transcript
- 4.4.4 Test confidence scoring logic
- 4.4.5 Test alternatives generation (up to 2 for medium confidence)
- 4.4.6 Test adapter error handling

**Acceptance Criteria**:
- [x] All test cases pass
- [x] Confidence tier logic verified
- [x] Error scenarios throw correct codes
- [x] Unit test coverage > 90%

---

### 4.5 Write Intent API Integration Tests

- **Status**: completed
- **Dependencies**: 4.3, 4.4
- **Tags**: test, integration, intent
- **Estimated Hours**: 3

**Description**:
Write integration tests for Intent routes.

**Sub-tasks**:
- 4.5.1 Setup test data (50 products with varied names)
- 4.5.2 Test POST /v1/intent/text end-to-end
- 4.5.3 Test POST /v1/intent/voice end-to-end
- 4.5.4 Test confidence tier scenarios (high, medium, low)
- 4.5.5 Test error scenarios

**Acceptance Criteria**:
- [x] All routes work end-to-end
- [x] Confidence scoring produces correct alternatives
- [x] All tests pass

---

## Phase 5: Smart Cart Service

The Smart Cart Service provides personalized recommendations based on user tier (order count).

### 5.1 Create Smart Cart Model and Types

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: model, types, smartcart
- **Estimated Hours**: 2

**Description**:
Define TypeScript interfaces for SmartCartResult, Recommendation, and related models.

**Sub-tasks**:
- 5.1.1 Define SmartCartResult interface
- 5.1.2 Define Recommendation interface
- 5.1.3 Define PurchaseCadence interface
- 5.1.4 Create Zod validation schemas
- 5.1.5 Create type exports

**Acceptance Criteria**:
- [x] SmartCartResult has fields: userId, pincode, tier, label, suggestions[], generatedAt
- [x] Recommendation has fields: productId, name, brand, price (paise), imageUrl, confidence, reason
- [x] PurchaseCadence tracks user purchase history for frequency analysis
- [x] Tier enum: 'trending' | 'hybrid' | 'personalize'

---

### 5.2 Create SmartCartService Implementation

- **Status**: completed
- **Dependencies**: 5.1, 0.1, 2.2
- **Tags**: service, smartcart, business-logic
- **Estimated Hours**: 8

**Description**:
Implement SmartCartService with tier-based personalization and stock filtering.

**Sub-tasks**:
- 5.2.1 Implement getSmartCart with cache (6-hour TTL: `smartcart:{userId}`)
- 5.2.2 Implement refreshSmartCart (bypass cache, regenerate)
- 5.2.3 Implement tier detection logic:
  - 0-4 orders: Tier 1 ('trending')
  - 5-19 orders: Tier 2 ('hybrid')
  - 20+ orders: Tier 3 ('personalize')
- 5.2.4 Implement Tier 1 logic (return trending products)
- 5.2.5 Implement Tier 2 logic (50% user history + 50% trending)
- 5.2.6 Implement Tier 3 logic (frequency-sorted from purchase history)
- 5.2.7 Implement stock filtering (only in-stock items)
- 5.2.8 Implement cache invalidation on order placement
- 5.2.9 Add error handling

**Acceptance Criteria**:
- [x] getSmartCart returns SmartCartResult with correct tier and label
- [x] Tier 1 (0-4 orders) returns trending with label "Popular Near You"
- [x] Tier 2 (5-19 orders) returns hybrid (50/50) with label "Based on Your Orders"
- [x] Tier 3 (20+ orders) returns frequency-sorted with label "Your Smart Cart"
- [x] All suggestions are in-stock (verified via InventoryService)
- [x] Cache (6-hour TTL) used by getSmartCart
- [x] refreshSmartCart bypasses cache
- [x] Cache key invalidated on order placement: `smartcart:{userId}`
- [x] User not found returns USER_NOT_FOUND (404)
- [x] No in-stock products returns NO_PRODUCTS_AVAILABLE (422)
- [x] Adapter error returns RECOMMENDATION_FAILED (500)

---

### 5.3 Create Smart Cart API Handler (Lambda)

- **Status**: completed
- **Dependencies**: 5.2
- **Tags**: handler, api, smartcart
- **Estimated Hours**: 2

**Description**:
Create Lambda handler for Smart Cart routes.

**Sub-tasks**:
- 5.3.1 Implement GET /v1/smart-cart handler
- 5.3.2 Implement POST /v1/smart-cart/refresh handler
- 5.3.3 Add response envelope formatting

**Acceptance Criteria**:
- [x] GET /v1/smart-cart returns 200 with SmartCartResult or 404/422/500 for errors
- [x] POST /v1/smart-cart/refresh returns 200 with fresh SmartCartResult
- [x] All responses include requestId and timestamp
- [x] JWT validation passes (401 if missing/invalid)

---

### 5.4 Write Smart Cart Service Unit Tests

- **Status**: completed
- **Dependencies**: 5.2
- **Tags**: test, unit, smartcart
- **Estimated Hours**: 5

**Description**:
Write unit tests for SmartCartService with mocked adapters.

**Sub-tasks**:
- 5.4.1 Test Tier 1 user (0-4 orders): returns trending
- 5.4.2 Test Tier 2 user (5-19 orders): returns hybrid recommendations
- 5.4.3 Test Tier 3 user (20+ orders): returns frequency-sorted
- 5.4.4 Test stock filtering (out-of-stock items excluded)
- 5.4.5 Test cache behavior (6-hour TTL)
- 5.4.6 Test refresh bypasses cache
- 5.4.7 Test error scenarios (user not found, no products available)

**Acceptance Criteria**:
- [x] All test cases pass
- [x] Tier logic verified for all three tiers
- [x] Stock filtering works correctly
- [x] Cache behavior correct
- [x] Unit test coverage > 90%

---

### 5.5 Write Smart Cart API Integration Tests

- **Status**: completed
- **Dependencies**: 5.3, 5.4
- **Tags**: test, integration, smartcart
- **Estimated Hours**: 4

**Description**:
Write integration tests for Smart Cart routes.

**Sub-tasks**:
- 5.5.1 Setup test data (3 test users: 2 orders, 10 orders, 25 orders)
- 5.5.2 Setup purchase history for users
- 5.5.3 Test GET /v1/smart-cart for each tier
- 5.5.4 Test POST /v1/smart-cart/refresh
- 5.5.5 Test cache invalidation on order placement
- 5.5.6 Test error scenarios

**Acceptance Criteria**:
- [x] All routes work end-to-end
- [x] Tier detection and recommendations correct
- [x] Cache invalidation works
- [x] All tests pass

---

## Phase 6: Orders Service

The Orders Service handles order placement, retrieval, and reorder functionality with multi-service integration.

### 6.1 Create Order Model and Types

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: model, types, orders
- **Estimated Hours**: 3

**Description**:
Define TypeScript interfaces for Order, OrderRequest, OrderItem, and related models.

**Sub-tasks**:
- 6.1.1 Define Order interface
- 6.1.2 Define OrderRequest interface
- 6.1.3 Define OrderItem interface
- 6.1.4 Define OrderStatus enum
- 6.1.5 Create Zod validation schemas
- 6.1.6 Create type exports

**Acceptance Criteria**:
- [x] Order has all required fields (orderId format: `ord_{timestamp}_{uuid}`, userId, status, items, prices in paise, eta, timestamps, payment info)
- [x] OrderRequest validates items array (non-empty), addressId
- [x] OrderStatus includes: PLACED, CONFIRMED, PICKED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
- [x] Validation schemas reject empty items, invalid addressId format

---

### 6.2 Create OrdersService Implementation

- **Status**: completed
- **Dependencies**: 6.1, 0.1, 2.2, 3.2, 5.2
- **Tags**: service, orders, business-logic
- **Estimated Hours**: 12

**Description**:
Implement OrdersService with order placement, retrieval, and reorder functionality.

**Sub-tasks**:
- 6.2.1 Implement placeOrder with validation (non-empty items, stock check)
- 6.2.2 Implement stock check via InventoryService
- 6.2.3 Implement soft-reserve via InventoryService
- 6.2.4 Implement ETA calculation via ETAService
- 6.2.5 Implement payment processing (mock in H1.2)
- 6.2.6 Implement DynamoDB write: SnapOrders table with orderId format `ord_{timestamp}_{uuid}`
- 6.2.7 Implement user totalOrders counter increment
- 6.2.8 Implement purchase cadence update (SnapPurchaseCadence table)
- 6.2.9 Implement SQS event publishing to snap-order-events-queue
- 6.2.10 Implement smart cart cache invalidation (`smartcart:{userId}`)
- 6.2.11 Implement getOrderHistory (paginated with cursor support)
- 6.2.12 Implement getOrder (single order by ID, user ownership check)
- 6.2.13 Implement getRecentOrders (last 5 orders)
- 6.2.14 Implement reorder (availability check and substitution logic)
- 6.2.15 Implement payment failure handling (release reserves, rollback)
- 6.2.16 Add comprehensive error handling

**Acceptance Criteria**:
- [x] placeOrder validates items (non-empty array) or throws EMPTY_CART (400)
- [x] placeOrder checks stock via InventoryService or throws OUT_OF_STOCK (422)
- [x] placeOrder soft-reserves items or throws RESERVATION_FAILED (422)
- [x] placeOrder calculates ETA via ETAService
- [x] placeOrder processes payment (mock) or throws PAYMENT_FAILED (422)
- [x] placeOrder writes order to DynamoDB with unique orderId format
- [x] placeOrder increments user's totalOrders counter
- [x] placeOrder updates purchase cadence for each product
- [x] placeOrder publishes to SQS snap-order-events-queue
- [x] placeOrder invalidates smart cart cache
- [x] placeOrder returns 201 with Order object on success
- [x] getOrderHistory returns paginated results with cursor support
- [x] getOrder returns order details or 404 if not found or unauthorized
- [x] getRecentOrders returns last 5 orders
- [x] reorder checks availability and substitutes unavailable items
- [x] reorder throws OUT_OF_STOCK (422) if multiple unavailable with no substitutes
- [x] reorder returns 201 with new Order on success
- [x] Duplicate orderId collision throws DUPLICATE_ORDER (409)
- [x] DynamoDB error returns INTERNAL_ERROR (500)

---

### 6.3 Create Orders API Handler (Lambda)

- **Status**: completed
- **Dependencies**: 6.2
- **Tags**: handler, api, orders
- **Estimated Hours**: 5

**Description**:
Create Lambda handler for Orders routes.

**Sub-tasks**:
- 6.3.1 Implement POST /v1/orders handler
- 6.3.2 Implement GET /v1/orders handler (with cursor/limit params)
- 6.3.3 Implement GET /v1/orders/{id} handler
- 6.3.4 Implement GET /v1/orders/recent handler
- 6.3.5 Implement POST /v1/orders/{id}/reorder handler
- 6.3.6 Add input validation (items array, addressId, orderId format)
- 6.3.7 Add user ownership checks (JWT userId vs resource owner)
- 6.3.8 Add response envelope formatting

**Acceptance Criteria**:
- [x] POST /v1/orders returns 201 with Order or 400/422 for validation errors
- [x] GET /v1/orders returns 200 with paginated order list
- [x] GET /v1/orders/{id} returns 200 with Order or 404 if not found/unauthorized
- [x] GET /v1/orders/recent returns 200 with last 5 orders
- [x] POST /v1/orders/{id}/reorder returns 201 with new Order or 422 for unavailable items
- [x] Invalid orderId format returns 400 with INVALID_REQUEST
- [x] User ownership check prevents cross-user access (404 if not authorized)
- [x] All responses include requestId and timestamp
- [x] JWT validation passes (401 if missing/invalid)

---

### 6.4 Write Orders Service Unit Tests

- **Status**: completed
- **Dependencies**: 6.2
- **Tags**: test, unit, orders
- **Estimated Hours**: 8

**Description**:
Write unit tests for OrdersService with mocked dependencies.

**Sub-tasks**:
- 6.4.1 Test placeOrder: success scenario
- 6.4.2 Test placeOrder: empty items validation
- 6.4.3 Test placeOrder: out of stock scenario
- 6.4.4 Test placeOrder: soft-reserve failure
- 6.4.5 Test placeOrder: payment failure with rollback
- 6.4.6 Test placeOrder: DynamoDB error handling
- 6.4.7 Test getOrderHistory: pagination with cursor
- 6.4.8 Test getOrder: success and not found scenarios
- 6.4.9 Test getRecentOrders
- 6.4.10 Test reorder: all items available
- 6.4.11 Test reorder: some items unavailable, substitutes available
- 6.4.12 Test reorder: multiple items unavailable, no substitutes (fail)

**Acceptance Criteria**:
- [x] All test cases pass
- [x] Mocked dependencies correctly substituted (InventoryService, ETAService, DynamoDB)
- [x] orderId format validation verified
- [x] Error scenarios throw correct codes and status
- [x] Payment failure rollback logic verified
- [x] Unit test coverage > 90%

---

### 6.5 Write Orders API Integration Tests

- **Status**: completed
- **Dependencies**: 6.3, 6.4
- **Tags**: test, integration, orders
- **Estimated Hours**: 8

**Description**:
Write integration tests for Orders routes with full service dependencies.

**Sub-tasks**:
- 6.5.1 Setup test data (3 test users, inventory records, order history)
- 6.5.2 Test POST /v1/orders end-to-end (with InventoryService, ETAService)
- 6.5.3 Test successful order placement and data consistency
- 6.5.4 Test failed order placement (out of stock, reservation failure)
- 6.5.5 Test GET /v1/orders end-to-end with pagination
- 6.5.6 Test GET /v1/orders/{id} end-to-end
- 6.5.7 Test GET /v1/orders/recent end-to-end
- 6.5.8 Test POST /v1/orders/{id}/reorder end-to-end
- 6.5.9 Test cross-user access prevention (401 for unauthorized)
- 6.5.10 Test error scenarios (empty items, invalid params)

**Acceptance Criteria**:
- [x] All routes work end-to-end
- [x] Service integration verified (inventory stock check, ETA calculation)
- [x] Data consistency validated (user counter updated, purchase cadence updated, cache invalidated)
- [x] SQS event published correctly
- [x] Error scenarios return correct status codes
- [x] All tests pass

---

## Phase 7: Cross-Cutting Concerns

### 7.1 Input Validation Framework

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: validation, utilities, infrastructure
- **Estimated Hours**: 3

**Description**:
Create comprehensive input validation using Zod for all request types.

**Sub-tasks**:
- 7.1.1 Create validation schemas for all common types (pincode, productId, quantity, barcode, search query, transcript, cursor, limit)
- 7.1.2 Create request validation middleware
- 7.1.3 Create error messages for validation failures

**Acceptance Criteria**:
- [x] Pincode validation: exactly 6 digits
- [x] ProductId validation: UUID format (36 chars with hyphens)
- [x] Quantity validation: integer 1-99
- [x] Search query validation: non-empty, max 200 chars
- [x] Barcode validation: EAN-13 (13 digits) or UPC (12 digits)
- [x] Transcript validation: non-empty, trimmed, not just whitespace
- [x] Invalid inputs rejected before business logic
- [x] Error responses include field name that failed validation

---

### 7.2 Response Envelope Implementation

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: api, utilities, infrastructure
- **Estimated Hours**: 2

**Description**:
Ensure all API responses follow standard envelope format with requestId and timestamp.

**Sub-tasks**:
- 7.2.1 Create response utility with success/error methods
- 7.2.2 Implement success envelope: `{ success: true, data, error: null, requestId, timestamp }`
- 7.2.3 Implement error envelope: `{ success: false, data: null, error: { code, message, details }, requestId, timestamp }`
- 7.2.4 Ensure all handlers use response utility

**Acceptance Criteria**:
- [x] All success responses have correct envelope format
- [x] All error responses have correct envelope format
- [x] requestId extracted from API Gateway context
- [x] timestamp in ISO 8601 format (UTC)
- [x] Content-Type header set to application/json

---

### 7.3 Authentication and Authorization

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: auth, security, infrastructure
- **Estimated Hours**: 3

**Description**:
Implement JWT authentication and authorization checks.

**Sub-tasks**:
- 7.3.1 Create auth middleware for JWT validation
- 7.3.2 Implement user ownership checks for user-specific resources
- 7.3.3 Create error handling for missing/expired/invalid JWT
- 7.3.4 Extract userId from JWT claims (sub field)

**Acceptance Criteria**:
- [x] Missing JWT returns 401 with UNAUTHORIZED
- [x] Expired JWT returns 401 with UNAUTHORIZED
- [x] Invalid JWT returns 401 with UNAUTHORIZED
- [x] Valid JWT extracts userId correctly
- [x] Cross-user access attempts return 404 (not 403 for security)
- [x] All user-specific routes validate ownership

---

### 7.4 Logging and Observability

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: logging, observability, infrastructure
- **Estimated Hours**: 3

**Description**:
Implement logging with requestId tracing and error logging without PII leaks.

**Sub-tasks**:
- 7.4.1 Create logger utility with log levels (error, warn, info, debug)
- 7.4.2 Include requestId in all logs for traceability
- 7.4.3 Include service name and userId (redacted) in error logs
- 7.4.4 Implement error logging without sensitive data (passwords, payment info, PII)
- 7.4.5 Generic error messages to clients (no internal details for 5xx errors)

**Acceptance Criteria**:
- [x] Logger includes requestId in all logs
- [x] Error logs include service name, severity level
- [x] No sensitive data logged (passwords, payment tokens, PII)
- [x] 5xx errors return generic "An unexpected error occurred" to client
- [x] 4xx errors return descriptive message to client
- [x] Stack traces logged only for 5xx errors (internal logs, not client response)

---

### 7.5 Error Code Definition and Handling

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: errors, utilities, infrastructure
- **Estimated Hours**: 2

**Description**:
Define all error codes and implement error factory.

**Sub-tasks**:
- 7.5.1 Define all error codes from requirements: PRODUCT_NOT_FOUND, BARCODE_NOT_FOUND, OUT_OF_STOCK, RESERVATION_FAILED, INVALID_QUANTITY, INVALID_PINCODE, EMPTY_CART, ORDER_NOT_FOUND, PAYMENT_FAILED, USER_NOT_FOUND, EMPTY_TRANSCRIPT, UNAUTHORIZED, FORBIDDEN, INVALID_REQUEST, etc.
- 7.5.2 Create AppError class with code, message, statusCode
- 7.5.3 Create error factory function
- 7.5.4 Ensure all services throw AppError

**Acceptance Criteria**:
- [x] All error codes defined in constants/errors.ts
- [x] AppError class works correctly
- [x] All services throw AppError (not generic Error)
- [x] Error codes map correctly to HTTP status codes

---

### 7.6 Cache Invalidation Strategy

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: cache, infrastructure
- **Estimated Hours**: 2

**Description**:
Implement cache invalidation triggers across services.

**Sub-tasks**:
- 7.6.1 Document cache keys and TTLs for all services
- 7.6.2 Implement cache invalidation on product updates (invalidate `product:{productId}` and `barcode:{*}`)
- 7.6.3 Implement cache invalidation on inventory updates (invalidate `inv:{pincode}:{productId}`)
- 7.6.4 Implement cache invalidation on order placement (invalidate `smartcart:{userId}`)
- 7.6.5 Verify cache invalidation is called at correct points

**Acceptance Criteria**:
- [x] Cache invalidation logic documented
- [x] Product update invalidates correct cache keys
- [x] Inventory update invalidates correct cache keys
- [x] Order placement invalidates smart cart cache
- [x] Soft-reservation expiry handled (TTL or scheduled cleanup)

---

### 7.7 DynamoDB Adapter Factory Configuration

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: adapters, infrastructure, configuration
- **Estimated Hours**: 2

**Description**:
Implement adapter factory for swappable implementations (H1.2: DynamoDB-based, future: production services).

**Sub-tasks**:
- 7.7.1 Create factory function that returns adapters based on environment flags
- 7.7.2 Implement DynamoSearchAdapter for search operations
- 7.7.3 Implement KeywordIntentAdapter for intent resolution
- 7.7.4 Implement RuleBasedRecommendationAdapter for recommendations
- 7.7.5 Verify adapters conform to standard interfaces

**Acceptance Criteria**:
- [x] Factory returns DynamoSearchAdapter when ENABLE_PRODUCTION_SEARCH=false
- [x] Factory returns KeywordIntentAdapter when ENABLE_PRODUCTION_INTENT=false
- [x] Factory returns RuleBasedRecommendationAdapter when ENABLE_PRODUCTION_RECOMMENDATIONS=false
- [x] Adapters implement standard interfaces
- [x] Configuration-based switching works without code changes

---

### 7.8 Test Fixtures and Seed Data

- **Status**: completed
- **Dependencies**: 0.1
- **Tags**: test, infrastructure
- **Estimated Hours**: 4

**Description**:
Create comprehensive test fixtures and seed data for integration tests.

**Sub-tasks**:
- 7.8.1 Create Product fixtures (50+ varied products with barcodes, prices, images)
- 7.8.2 Create Inventory fixtures (inventory records for 3 pincodes)
- 7.8.3 Create DarkStore fixtures (3 dark stores with service config)
- 7.8.4 Create User fixtures (3 test users with varied order counts)
- 7.8.5 Create Order fixtures (10 historical orders per user)
- 7.8.6 Create mock adapter implementations for testing

**Acceptance Criteria**:
- [x] Fixtures provide builders for all model types
- [x] Seed data can be loaded into DynamoDB Local
- [x] Seed data covers all test scenarios
- [x] Mock adapters work for unit testing

---

### 7.9 Code Coverage and Quality Checks

- **Status**: completed
- **Dependencies**: All testing tasks
- **Tags**: test, quality, infrastructure
- **Estimated Hours**: 3

**Description**:
Verify 80%+ code coverage and run linters/formatters.

**Sub-tasks**:
- 7.9.1 Generate code coverage report
- 7.9.2 Run ESLint to check code quality
- 7.9.3 Run Prettier to format code
- 7.9.4 Verify coverage > 80% for each service
- 7.9.5 Fix any lint or coverage issues

**Acceptance Criteria**:
- [x] Overall code coverage >= 80%
- [x] ProductsService coverage >= 90%
- [x] InventoryService coverage >= 90%
- [x] ETAService coverage >= 90%
- [x] IntentService coverage >= 90%
- [x] SmartCartService coverage >= 90%
- [x] OrdersService coverage >= 90%
- [x] All linting errors fixed
- [x] Code formatted consistently

---

### 7.10 API Documentation and README

- **Status**: completed
- **Dependencies**: All implementation tasks
- **Tags**: documentation, api
- **Estimated Hours**: 4

**Description**:
Create comprehensive API documentation and README.

**Sub-tasks**:
- 7.10.1 Create API endpoint documentation (all routes, request/response formats)
- 7.10.2 Create error code reference
- 7.10.3 Create quick-start guide
- 7.10.4 Create deployment instructions
- 7.10.5 Create troubleshooting guide

**Acceptance Criteria**:
- [x] All 30+ API endpoints documented
- [x] Request and response examples provided
- [x] Error codes and meanings documented
- [x] Setup instructions clear and complete
- [x] README includes architecture diagram
- [x] Performance targets documented

---

## Summary

**Total Tasks**: 64 sub-tasks across 7 phases

**Dependency Chain**:
```
Phase 0: Foundation & Setup
└─ Phase 1: Products Service (no dependencies)
   ├─ Phase 2: Inventory Service
   │  ├─ Phase 3: ETA Service
   │  │  └─ Phase 6: Orders Service
   │  └─ Phase 5: Smart Cart Service
   │     └─ Phase 6: Orders Service
   └─ Phase 4: Intent Service
└─ Phase 7: Cross-Cutting Concerns (parallel)
```

**Estimated Total Hours**: ~130-150 hours for complete implementation including tests and documentation

**Success Criteria**:
- All 17 requirements fully implemented
- 80%+ code coverage
- All unit and integration tests passing
- API performance meets latency targets
- Full documentation complete
- Ready for Phase H1.3 (Frontend Integration)
