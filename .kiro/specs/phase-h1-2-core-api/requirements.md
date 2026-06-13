# Requirements Document: Phase H1.2 - Core API Implementation

## Introduction

Phase H1.2 implements six core REST API services for the Amazon Now Snap application in Hackathon Mode. These services form the backbone of the product ordering system, providing product discovery, inventory management, delivery estimates, intent resolution, personalized recommendations, and order placement. All services operate in strict dependency order (Products → Inventory → ETA → Intent → Smart Cart → Orders) and use DynamoDB-based adapters to ensure the system functions independently without paid third-party services. This requirements document specifies the behavior, interfaces, and guarantees that each service must provide.

## Glossary

- **System**: Refers to the Phase H1.2 Core API Implementation as a whole
- **Product_Service**: REST API service for product catalog management and search
- **Inventory_Service**: REST API service for stock level management with soft-reserve capability
- **ETA_Service**: REST API service for delivery time estimation
- **Intent_Service**: REST API service for resolving user intent from text or voice input
- **Smart_Cart_Service**: REST API service for personalized product recommendations
- **Orders_Service**: REST API service for order placement and history management
- **Client**: Mobile or web application making requests to the System
- **Adapter**: Pluggable implementation of a service interface (SearchAdapter, CacheAdapter, IntentAdapter, RecommendationAdapter)
- **DynamoDB**: NoSQL database used for all data persistence in Hackathon Mode
- **Soft_Reserve**: Temporary hold on inventory units during order checkout (90-second expiration)
- **Dark_Store**: Fulfillment center that serves specific geographic areas (pincodes)
- **Pincode**: Indian postal code (6-digit format for geographic area identification)
- **Intent**: Parsed user request to purchase specific product(s)
- **Confidence**: Numerical score (0.0–1.0) indicating likelihood that resolved intent matches user's actual need
- **Tier**: User segmentation based on order count (Tier 1: 0–4 orders, Tier 2: 5–19 orders, Tier 3: 20+ orders)
- **Purchase_Cadence**: Historical purchase frequency data for a user-product pair
- **TTL**: Time-To-Live cache expiration timeout in seconds
- **HTTP_Status**: Standard HTTP response code (200, 201, 400, 401, 404, 422, 500, 503)
- **Response_Envelope**: Standardized JSON structure for all API responses (success/error with requestId and timestamp)
- **JWT**: JSON Web Token issued by Cognito User Pool for authentication
- **Paise**: Indian currency subunit (1 INR = 100 paise; all prices stored in paise)
- **Barcode**: EAN-13 or UPC barcode for product lookup

## Requirements

### Requirement 1: Product Service Catalog Management

**User Story:** As a mobile app user, I want to discover products through multiple lookup methods (ID, barcode, search, trending), so that I can quickly find items I wish to purchase.

#### Acceptance Criteria

1. WHEN a Client requests a product by ID via `GET /v1/products/{id}`, THE Product_Service SHALL retrieve the product from cache or database and return it with HTTP 200
2. WHEN the product ID is invalid or not found, THE Product_Service SHALL return HTTP 404 with error code `PRODUCT_NOT_FOUND`
3. WHEN a Client requests a product by barcode via `GET /v1/products/barcode/{code}`, THE Product_Service SHALL perform a fast lookup and return the matching product with HTTP 200
4. WHEN the barcode does not exist in the catalog, THE Product_Service SHALL return HTTP 404 with error code `BARCODE_NOT_FOUND`
5. WHEN a Client requests trending products via `GET /v1/products/trending?pincode={pincode}`, THE Product_Service SHALL return trending products for that pincode with HTTP 200
6. WHEN a Client requests to search products via `GET /v1/products/search?q={query}&pincode={pincode}`, THE Product_Service SHALL return matching products ranked by relevance score with HTTP 200
7. WHEN a search query returns no results, THE Product_Service SHALL return an empty array with HTTP 200
8. WHEN a Client provides an invalid pincode (not 6 digits), THE Product_Service SHALL return HTTP 400 with error code `INVALID_PINCODE`
9. WHEN caching a product detail (after retrieval), THE Product_Service SHALL store it with TTL of 3600 seconds (1 hour) using the key `product:{productId}`
10. WHEN caching a barcode mapping (after retrieval), THE Product_Service SHALL store it with TTL of 3600 seconds (1 hour) using the key `barcode:{barcodeValue}`
11. WHEN caching trending products (after retrieval), THE Product_Service SHALL store them with TTL of 900 seconds (15 minutes) using the key `trending:{pincode}`
12. WHERE a Product_Service request includes an invalid or expired JWT token, THE System SHALL return HTTP 401

_Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

---

### Requirement 2: Inventory Stock Management

**User Story:** As an order system, I want real-time visibility into stock levels with the ability to temporarily reserve items during checkout, so that I can prevent overselling and ensure accurate fulfillment.

#### Acceptance Criteria

1. WHEN a Client requests inventory status via `GET /v1/inventory/{pincode}/{productId}`, THE Inventory_Service SHALL check stock level and return availability with HTTP 200
2. WHEN the stock level is zero or all units are reserved, THE Inventory_Service SHALL return HTTP 422 with error code `OUT_OF_STOCK`
3. WHEN a Client requests batch inventory check via `POST /v1/inventory/batch-check` with multiple product IDs, THE Inventory_Service SHALL check all products and return an array of status objects with HTTP 200
4. WHEN a requested quantity exceeds the available stock, THE Inventory_Service SHALL indicate the product as unavailable in the response
5. WHEN caching an inventory record (after retrieval), THE Inventory_Service SHALL store it with TTL of 30 seconds using the key `inv:{pincode}:{productId}`
6. WHEN a soft-reserve operation is initiated, THE Inventory_Service SHALL attempt a conditional write that increments `reservedUnits` only if `stockLevel > reservedUnits`
7. WHEN the conditional write for soft-reserve succeeds, THE Inventory_Service SHALL set the reservation expiration timestamp to current time + 90 seconds
8. WHEN the conditional write for soft-reserve fails (stock exhausted), THE Inventory_Service SHALL return HTTP 422 with error code `RESERVATION_FAILED`
9. WHEN a Client provides a quantity outside the valid range (1–99), THE Inventory_Service SHALL return HTTP 400 with error code `INVALID_QUANTITY`
10. WHEN a soft-reservation expires (90 seconds elapsed), THE System SHALL automatically decrement `reservedUnits` and release the hold
11. WHERE inventory operations fail due to DynamoDB unavailability, THE Inventory_Service SHALL return HTTP 500 with error code `STOCK_CHECK_FAILED`
12. WHERE a request attempts soft-reserve without prior stock check validation, THE Inventory_Service SHALL perform the validation inline before attempting the reserve

_Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

---

### Requirement 3: Delivery Time Estimation

**User Story:** As a user, I want accurate delivery time estimates for products before completing purchase, so that I can make informed decisions about urgency and plan my schedule accordingly.

#### Acceptance Criteria

1. WHEN a Client requests ETA via `GET /v1/eta?pincode={pincode}&productId={productId}`, THE ETA_Service SHALL calculate and return the estimated delivery time with HTTP 200
2. WHEN the pincode is not serviceable (no dark store), THE ETA_Service SHALL return HTTP 422 with error code `PINCODE_NOT_SERVICEABLE`
3. WHEN the dark store serving the pincode is offline, THE ETA_Service SHALL return HTTP 503 with error code `DARKSTORE_OFFLINE`
4. WHEN a Client requests batch ETA calculation via `POST /v1/eta/batch` with multiple pincodes and product IDs, THE ETA_Service SHALL return an array of ETA results with HTTP 200
5. WHEN calculating ETA, THE ETA_Service SHALL look up the dark store serving the pincode and retrieve `avgPickupMinutes` from its configuration
6. WHEN calculating ETA, THE ETA_Service SHALL add a fixed last-mile delivery estimate (based on distance) to `avgPickupMinutes`
7. WHEN caching an ETA result (after calculation), THE ETA_Service SHALL store it with TTL of 60 seconds using the key `eta:{pincode}:{darkStoreId}`
8. WHEN returning an ETA result, THE ETA_Service SHALL include both a relative label (e.g., "8–10 minutes") and an absolute ISO 8601 timestamp (`etaAt`)
9. WHERE ETA calculation fails due to missing dark store configuration, THE ETA_Service SHALL return HTTP 500 with error code `ETA_CALCULATION_FAILED`
10. WHERE multiple dark stores serve a pincode, THE ETA_Service SHALL select the one with the shortest `avgPickupMinutes`

_Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

---

### Requirement 4: Intent Resolution

**User Story:** As a user, I want to express my purchase intent through text or voice input and receive product recommendations, so that I can shop efficiently without complex navigation.

#### Acceptance Criteria

1. WHEN a Client submits text intent via `POST /v1/intent/text` with a non-empty transcript, THE Intent_Service SHALL resolve the intent and return a product recommendation with HTTP 200
2. WHEN a Client submits voice intent via `POST /v1/intent/voice` with a non-empty transcript, THE Intent_Service SHALL resolve the intent and return a product recommendation with HTTP 200
3. WHEN the transcript is empty or contains only whitespace, THE Intent_Service SHALL return HTTP 400 with error code `EMPTY_TRANSCRIPT`
4. WHEN the Intent_Service resolves a product with confidence ≥ 0.75, THE Intent_Service SHALL return a single product without alternatives
5. WHEN the Intent_Service resolves a product with confidence between 0.50 and 0.74, THE Intent_Service SHALL return the top product plus up to 2 alternative recommendations
6. WHEN the Intent_Service resolves with confidence < 0.50, THE Intent_Service SHALL return HTTP 200 with `resolvedBy: 'none'` and a `suggestedInput` hint
7. WHEN resolving intent, THE Intent_Service SHALL query the SearchAdapter for candidate products based on normalized query tokens
8. WHEN calculating confidence scores, THE Intent_Service SHALL normalize text (lowercase, remove punctuation) and match against product names, brands, and descriptions
9. WHERE intent resolution fails due to adapter error, THE Intent_Service SHALL return HTTP 500 with error code `INTENT_RESOLUTION_FAILED`
10. WHEN returning a resolved product, THE Intent_Service SHALL include the `confidence` score and `reason` explanation for the resolution
11. WHERE a Client request includes an invalid or expired JWT token, THE System SHALL return HTTP 401

_Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_

---

### Requirement 5: Smart Cart Personalized Recommendations

**User Story:** As a user, I want personalized product recommendations in my smart cart based on my order history and purchase patterns, so that I can quickly refill essential items and discover relevant products.

#### Acceptance Criteria

1. WHEN a Client requests smart cart via `GET /v1/smart-cart`, THE Smart_Cart_Service SHALL return personalized recommendations with HTTP 200
2. WHEN a user has placed 0–4 orders, THE Smart_Cart_Service SHALL assign tier `'trending'` and return trending products with label "Popular Near You"
3. WHEN a user has placed 5–19 orders, THE Smart_Cart_Service SHALL assign tier `'hybrid'` and return 50% user history + 50% trending products with label "Based on Your Orders"
4. WHEN a user has placed 20+ orders, THE Smart_Cart_Service SHALL assign tier `'personalize'` and return frequency-sorted products from purchase history with label "Your Smart Cart"
5. WHEN retrieving smart cart recommendations, THE Smart_Cart_Service SHALL filter suggestions to include only products with available stock
6. WHEN caching smart cart recommendations (after generation), THE Smart_Cart_Service SHALL store them with TTL of 21600 seconds (6 hours) using the key `smartcart:{userId}`
7. WHEN generating Tier 2 or Tier 3 recommendations, THE Smart_Cart_Service SHALL query the user's purchase history and purchase cadence from DynamoDB
8. WHEN a Client requests smart cart refresh via `POST /v1/smart-cart/refresh`, THE Smart_Cart_Service SHALL bypass cache and regenerate recommendations with HTTP 200
9. WHEN all candidate recommendations are out of stock, THE Smart_Cart_Service SHALL return HTTP 422 with error code `NO_PRODUCTS_AVAILABLE`
10. WHEN a user profile does not exist, THE Smart_Cart_Service SHALL return HTTP 404 with error code `USER_NOT_FOUND`
11. WHERE recommendation generation fails due to adapter error, THE Smart_Cart_Service SHALL return HTTP 500 with error code `RECOMMENDATION_FAILED`
12. WHEN returning smart cart result, THE Smart_Cart_Service SHALL include the assigned tier, label, and `generatedAt` timestamp

_Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12_

---

### Requirement 6: Order Placement and Management

**User Story:** As a user, I want to place orders with multiple items, track their status, and reorder previous purchases, so that I can complete transactions efficiently and repeat convenient purchases.

#### Acceptance Criteria

1. WHEN a Client places an order via `POST /v1/orders` with valid items and address ID, THE Orders_Service SHALL validate stock availability and return HTTP 201 with the created order
2. WHEN an order request contains an empty items array, THE Orders_Service SHALL return HTTP 400 with error code `EMPTY_CART`
3. WHEN order placement is attempted but any item is out of stock, THE Orders_Service SHALL return HTTP 422 with error code `OUT_OF_STOCK`
4. WHEN order placement is attempted but soft-reserve fails for any item, THE Orders_Service SHALL return HTTP 422 with error code `RESERVATION_FAILED` and release any partial reserves
5. WHEN order placement succeeds, THE Orders_Service SHALL soft-reserve all items with a 90-second window for payment completion
6. WHEN order placement succeeds, THE Orders_Service SHALL calculate ETA via ETA_Service and include it in the order record
7. WHEN order placement succeeds, THE Orders_Service SHALL write the order to DynamoDB with a unique `orderId` using the format `ord_{timestamp}_{uuid}`
8. WHEN order placement succeeds, THE Orders_Service SHALL increment the user's `totalOrders` counter in the SnapUsers table
9. WHEN order placement succeeds, THE Orders_Service SHALL update the user's purchase cadence for each product in the SnapPurchaseCadence table
10. WHEN order placement succeeds, THE Orders_Service SHALL publish an order event to the SQS `snap-order-events-queue`
11. WHEN order placement succeeds, THE Orders_Service SHALL invalidate the user's smart cart cache (key `smartcart:{userId}`)
12. WHEN the payment processing fails, THE Orders_Service SHALL release all soft-reserves and return HTTP 422 with error code `PAYMENT_FAILED`
13. WHEN a Client requests order history via `GET /v1/orders` with optional cursor and limit parameters, THE Orders_Service SHALL return paginated order list with HTTP 200
14. WHEN a Client requests a specific order via `GET /v1/orders/{id}`, THE Orders_Service SHALL return the order details if it belongs to the authenticated user with HTTP 200
15. WHEN a Client requests an order that doesn't belong to them, THE Orders_Service SHALL return HTTP 404 with error code `ORDER_NOT_FOUND`
16. WHEN a Client requests recent orders via `GET /v1/orders/recent`, THE Orders_Service SHALL return the last 5 orders with HTTP 200
17. WHEN a Client initiates reorder via `POST /v1/orders/{id}/reorder`, THE Orders_Service SHALL check availability of original items and substitute unavailable items if possible
18. WHEN reorder is initiated but multiple items are unavailable with no substitutes, THE Orders_Service SHALL return HTTP 422 with error code `OUT_OF_STOCK`
19. WHEN reorder succeeds, THE Orders_Service SHALL create a new order and return HTTP 201
20. WHEN creating an order, THE Orders_Service SHALL validate that the address ID exists and belongs to the user (external validation via Address_Service)
21. WHERE order placement fails due to DynamoDB error, THE Orders_Service SHALL return HTTP 500 with error code `INTERNAL_ERROR`
22. WHERE an `orderId` collision is detected (extremely rare), THE Orders_Service SHALL return HTTP 409 with error code `DUPLICATE_ORDER`

_Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15, 6.16, 6.17, 6.18, 6.19, 6.20, 6.21, 6.22_

---

### Requirement 7: Standard Response Format

**User Story:** As a client application, I want all API responses to follow a consistent structure with metadata, so that I can reliably parse responses and handle errors uniformly.

#### Acceptance Criteria

1. WHEN any API request succeeds, THE System SHALL return a response with structure: `{ success: true, data: {...}, error: null, requestId: string, timestamp: ISO8601 }`
2. WHEN any API request fails, THE System SHALL return a response with structure: `{ success: false, data: null, error: { code: string, message: string, details?: unknown }, requestId: string, timestamp: ISO8601 }`
3. WHEN a response is generated, THE System SHALL include the `requestId` from the API Gateway request context
4. WHEN a response is generated, THE System SHALL include a `timestamp` in ISO 8601 format (UTC)
5. WHERE a response body is returned, THE System SHALL set the `Content-Type` header to `application/json`
6. WHERE a response indicates success, THE System SHALL ensure the HTTP status code is in the 2xx range
7. WHERE a response indicates client error, THE System SHALL ensure the HTTP status code is in the 4xx range
8. WHERE a response indicates server error, THE System SHALL ensure the HTTP status code is in the 5xx range

_Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

---

### Requirement 8: Authentication and Authorization

**User Story:** As a security-conscious system, I want to ensure that all API requests are authenticated via JWT and authorized based on user identity, so that user data remains protected and operations are restricted to authorized users.

#### Acceptance Criteria

1. WHEN any API request is made without a JWT token, THE System SHALL return HTTP 401 with error code `UNAUTHORIZED`
2. WHEN any API request includes an expired JWT token, THE System SHALL return HTTP 401 with error code `UNAUTHORIZED`
3. WHEN any API request includes an invalid or malformed JWT token, THE System SHALL return HTTP 401 with error code `UNAUTHORIZED`
4. WHEN a JWT token is valid, THE System SHALL extract the `sub` claim and use it as the authenticated `userId`
5. WHEN a user attempts to access resources (orders, smart cart) belonging to another user, THE System SHALL return HTTP 403 with error code `FORBIDDEN`
6. WHERE JWT validation is performed by API Gateway Authorizer before Lambda invocation, THE Lambda handler SHALL trust the `requestContext.authorizer.jwt.claims.sub` value
7. WHEN a request context does not include user identity, THE System SHALL return HTTP 401 with error code `UNAUTHORIZED`

_Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

---

### Requirement 9: Input Validation

**User Story:** As a robust API, I want to validate all client inputs before processing, so that I can prevent invalid data from being stored and provide clear feedback to clients.

#### Acceptance Criteria

1. WHEN a Client provides a pincode, THE System SHALL validate that it matches exactly 6 digits
2. WHEN a Client provides a product ID, THE System SHALL validate that it matches UUID format (36 characters with hyphens)
3. WHEN a Client provides a quantity, THE System SHALL validate that it is an integer between 1 and 99 (inclusive)
4. WHEN a Client provides a search query, THE System SHALL validate that it is not empty and does not exceed 200 characters
5. WHEN a Client provides a barcode, THE System SHALL validate that it matches EAN-13 format (13 digits) or UPC format (12 digits)
6. WHEN a Client provides a transcript (text or voice intent), THE System SHALL validate that it is not empty and does not contain only whitespace
7. WHEN a Client provides a JSON request body, THE System SHALL validate that it is valid JSON before processing
8. WHEN a request fails validation, THE System SHALL return HTTP 400 with error code `INVALID_REQUEST` and include which field failed validation in the error details
9. WHERE a Client provides an invalid input format, THE System SHALL reject the request without passing it to business logic
10. WHERE a Client provides a parameter with SQL injection attempt, THE System SHALL treat it as a literal string (DynamoDB uses parameterized expressions, not string interpolation)

_Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

---

### Requirement 10: Performance and Latency

**User Story:** As a user-facing system, I want response times to be fast and consistent, so that the mobile app remains responsive and provides a good user experience.

#### Acceptance Criteria

1. WHEN a Client requests `GET /v1/products/{id}`, THE System SHALL respond within 50ms P50, 100ms P95, 150ms P99
2. WHEN a Client requests `GET /v1/products/barcode/{code}`, THE System SHALL respond within 50ms P50, 100ms P95, 150ms P99
3. WHEN a Client requests `GET /v1/products/search`, THE System SHALL respond within 200ms P50, 400ms P95, 600ms P99
4. WHEN a Client requests `GET /v1/inventory/{pincode}/{productId}`, THE System SHALL respond within 30ms P50, 50ms P95, 100ms P99
5. WHEN a Client requests `POST /v1/inventory/batch-check`, THE System SHALL respond within 100ms P50, 200ms P95, 300ms P99
6. WHEN a Client requests `GET /v1/eta`, THE System SHALL respond within 50ms P50, 100ms P95, 150ms P99
7. WHEN a Client requests `POST /v1/intent/text`, THE System SHALL respond within 300ms P50, 500ms P95, 800ms P99
8. WHEN a Client requests `GET /v1/smart-cart`, THE System SHALL respond within 100ms P50, 200ms P95, 400ms P99
9. WHEN a Client requests `POST /v1/orders`, THE System SHALL respond within 500ms P50, 800ms P95, 1200ms P99
10. WHEN a Client requests `GET /v1/orders`, THE System SHALL respond within 100ms P50, 200ms P95, 300ms P99

_Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

---

### Requirement 11: Error Handling and Logging

**User Story:** As an observable system, I want all errors to be logged with context and returned to clients in a consistent format, so that issues can be debugged and user experience remains consistent.

#### Acceptance Criteria

1. WHEN an error occurs during request processing, THE System SHALL log it with severity level `ERROR`
2. WHEN an error is logged, THE System SHALL include the `requestId` for traceability
3. WHEN an error is logged, THE System SHALL include the service name that generated the error
4. WHEN an error is logged, THE System SHALL include the authenticated `userId` if available (redacted if containing PII)
5. WHEN an error is logged, THE System SHALL include the error message and stack trace for internal errors
6. WHEN an error is logged, THE System SHALL NOT include sensitive data (passwords, payment info, PII) in log output
7. WHEN a client error occurs (4xx), THE System SHALL return a user-friendly error message
8. WHEN a server error occurs (5xx), THE System SHALL return a generic message "An unexpected error occurred" without leaking internal details
9. WHERE an unhandled exception occurs, THE System SHALL return HTTP 500 with error code `INTERNAL_ERROR`
10. WHERE DynamoDB is unavailable, THE System SHALL return HTTP 503 with error code `SERVICE_UNAVAILABLE` (or specific service error)

_Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

---

### Requirement 12: Cache Invalidation

**User Story:** As a cached system, I want stale data to be invalidated at the right time, so that users always see the most current information when necessary.

#### Acceptance Criteria

1. WHEN a product is updated, THE System SHALL invalidate cache keys `product:{productId}` and all `barcode:{*}` mappings for that product
2. WHEN inventory stock is updated, THE System SHALL invalidate cache key `inv:{pincode}:{productId}`
3. WHEN an order is successfully placed, THE System SHALL invalidate the user's smart cart cache key `smartcart:{userId}`
4. WHEN a cache entry reaches its TTL expiration, THE System SHALL automatically delete it
5. WHEN a soft-reservation is released (by user action or 90-second expiry), THE System SHALL invalidate the reservation cache key
6. WHERE a cache update conflicts with a new operation, THE System SHALL accept the new operation and allow cache to be re-populated on next read

_Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

---

### Requirement 13: Adapter Pattern and Dependency Injection

**User Story:** As a pluggable system, I want adapters to be swappable between Hackathon and Production implementations, so that the system can transition to production AI/ML services without code changes.

#### Acceptance Criteria

1. WHEN the System initializes, THE System SHALL instantiate adapters based on configuration flags (e.g., `ENABLE_PRODUCTION_SEARCH`)
2. WHEN `ENABLE_PRODUCTION_SEARCH` is false, THE System SHALL use DynamoSearchAdapter for search operations
3. WHEN `ENABLE_PRODUCTION_INTENT` is false, THE System SHALL use KeywordIntentAdapter for intent resolution
4. WHEN `ENABLE_PRODUCTION_RECOMMENDATIONS` is false, THE System SHALL use RuleBasedRecommendationAdapter for recommendations
5. WHEN an adapter's implementation changes, THE System SHALL not require code changes to service logic (adapters conform to standard interface)
6. WHERE adapter factory is invoked, THE System SHALL return the appropriate adapter based on configuration

_Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

---

### Requirement 14: Data Integrity and Concurrency

**User Story:** As a reliable system, I want to handle concurrent requests correctly without race conditions or data corruption, so that the system remains consistent under load.

#### Acceptance Criteria

1. WHEN multiple clients concurrently request the same product, THE System SHALL return consistent data
2. WHEN multiple clients concurrently attempt soft-reserve on limited stock, THE System SHALL ensure that only one succeeds (conditional write prevents overselling)
3. WHEN an order is being placed while inventory is being updated, THE System SHALL check stock at order time (not rely on stale cache)
4. WHEN a soft-reservation expires while payment is being processed, THE System SHALL handle the race condition gracefully (release after expiry or on completion, whichever is later)
5. WHERE DynamoDB conditional writes are used, THE System SHALL ensure atomicity (all-or-nothing semantics)
6. WHERE cache is used for inventory, THE System SHALL always check DynamoDB for final validation on critical operations (soft-reserve, order placement)

_Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

---

### Requirement 15: Service Dependency Order

**User Story:** As an ordered system, I want services to be implemented in strict dependency order, so that each service can rely on previous services being available and tested.

#### Acceptance Criteria

1. WHEN Phase H1.2 implementation begins, THE System SHALL implement services in this order: Products → Inventory → ETA → Intent → Smart Cart → Orders
2. WHEN Products Service is complete, THE System SHALL have all product discovery endpoints functional
3. WHEN Inventory Service is complete, THE System SHALL have stock checking and soft-reserve capabilities functional
4. WHEN ETA Service is complete, THE System SHALL have delivery time estimation functional
5. WHEN Intent Service is complete, THE System SHALL have user intent resolution functional
6. WHEN Smart Cart Service is complete, THE System SHALL have personalized recommendations functional
7. WHEN Orders Service is implemented, THE Orders_Service SHALL depend on InventoryService and ETAService being operational
8. WHERE a later service depends on an earlier service, THE System SHALL verify the dependency is available before attempting to use it

_Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

---

### Requirement 16: Pricing and Financial Data

**User Story:** As an order system, I want to store all prices in paise (Indian currency subunit) and handle financial calculations accurately, so that billing is correct and rounding errors are avoided.

#### Acceptance Criteria

1. WHEN a product price is stored, THE System SHALL store it in paise (1 INR = 100 paise)
2. WHEN order subtotal is calculated, THE System SHALL sum individual item prices (each priced at order time) in paise
3. WHEN delivery fee is added, THE System SHALL add it to subtotal in paise to calculate total
4. WHEN returning prices in API responses, THE System SHALL return prices as integers in paise (no decimals)
5. WHERE a product price is displayed to the user, THE CLIENT SHALL convert paise to INR for display (System responsibility: paise storage and calculation)

_Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

---

### Requirement 17: Order Intent Tracking

**User Story:** As an analytics system, I want to track the source of each order's intent (photo, voice, smart cart, reorder, manual, barcode, text), so that I can measure which features drive conversions.

#### Acceptance Criteria

1. WHEN an order is placed, THE Orders_Service SHALL record the `intentSource` field indicating how the order was initiated
2. WHEN an order is placed via product search (barcode, text), THE Orders_Service SHALL set `intentSource` to the appropriate value (e.g., `'barcode'`, `'text'`)
3. WHEN an order is placed via smart cart, THE Orders_Service SHALL set `intentSource` to `'smart_cart'`
4. WHEN an order is reordered, THE Orders_Service SHALL set `intentSource` to `'reorder'`
5. WHEN querying order history, THE Orders_Service SHALL return the `intentSource` for each order

_Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

---

## Notes on Requirements Structure

### Traceability

- Each requirement is uniquely identified with a number (1–17)
- Each acceptance criterion is numbered with granular sub-requirements (e.g., 1.1, 1.2, etc.)
- Requirements reference acceptance criteria in the "Acceptance Criteria" sections

### Quality Standards Applied

- **EARS Patterns**: All requirements follow one of six EARS patterns (Ubiquitous, Event-driven, State-driven, Unwanted event, Optional feature, Complex)
- **Clarity**: No vague terms (all performance targets are specific, all validation rules are explicit)
- **Testability**: All acceptance criteria are measurable or verifiable
- **Completeness**: No escape clauses ("where possible"), all conditions explicitly stated
- **Positive Statements**: Requirements focus on what the system SHALL do (not what it SHALL NOT do, except for error cases)

### Cross-References

- Requirements 1–6 define the six core services
- Requirement 7 defines standard response format (applies to all services)
- Requirement 8 defines authentication and authorization (applies to all services)
- Requirements 9–17 define cross-cutting concerns (validation, performance, error handling, caching, etc.)

### Dependency Notes

- Products Service has no dependencies on other services (can be implemented first)
- Inventory Service depends on Products Service (for product IDs in validation)
- ETA Service depends on Inventory Service (for dark store lookup)
- Intent Service depends on Products and Inventory Services (for candidate products)
- Smart Cart Service depends on Inventory Service (for stock filtering)
- Orders Service depends on Inventory and ETA Services (for fulfillment)
