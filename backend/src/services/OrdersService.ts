/**
 * Amazon Now Snap — Orders Service
 *
 * Business-logic layer for order operations.
 * All monetary values in paise (integers). 1 INR = 100 paise.
 *
 * Routes served:
 *   POST /v1/orders
 *   GET  /v1/orders
 *   GET  /v1/orders/recent
 *   GET  /v1/orders/{orderId}
 *   POST /v1/orders/{orderId}/reorder
 *
 * Auth: JWT Bearer token required (userId extracted by handlers)
 * Model: @models/Order
 */

import { getItem, putItem, updateItem, queryItems, TABLE_NAMES } from '@clients/dynamoClient';
import { cacheAdapter } from '@adapters/factory';
import { logger } from '@utils/logger';
import { AppError, ErrorCodes } from '@constants/errors';
import { Order, OrderItem, OrderRequest, OrderStatus } from '@models/Order';
import { Product } from '@models/Product';

// ============================================================================
// Constants
// ============================================================================

/** Hackathon: fixed ETA for every order */
const HACKATHON_ETA_MINUTES = 12;

/** Hackathon: one dark store services all pincodes */
const DEFAULT_DARK_STORE_ID = 'ds_lajpat_nagar';

// ============================================================================
// generateOrderId
// ============================================================================

/**
 * Generate a unique order ID.
 * Format: ord_{timestamp}_{uuid6}  e.g. ord_1704067200000_abc123
 * Matches regex /^ord_\d+_[a-z0-9]{6}$/
 */
export function generateOrderId(): string {
  return `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// placeOrder
// ============================================================================

/**
 * Place a new order for a user.
 *
 * Validates:
 *  - items array is non-empty (EMPTY_CART 400)
 *  - every product exists in SnapProducts (PRODUCT_NOT_FOUND 404)
 *
 * Uses ConditionExpression to prevent duplicate orderIds (DUPLICATE_ORDER 409).
 * Increments user totalOrders counter after successful write.
 * Invalidates smart cart cache.
 *
 * ETA: hardcoded 12 minutes for hackathon.
 * Payment: mocked as COMPLETED.
 * Stock checks: skipped for hackathon.
 */
export async function placeOrder(userId: string, request: OrderRequest): Promise<Order> {
  // Validate non-empty items
  if (request.items.length === 0) {
    throw new AppError(ErrorCodes.EMPTY_CART, 'Cart is empty — add items before placing an order', 400);
  }

  // Fetch product details and build order items
  const orderItems: OrderItem[] = [];
  let subtotal = 0;

  for (const reqItem of request.items) {
    // Products has composite key (productId PK + sku SK) — use queryItems on PK alone
    const { items: productItems } = await queryItems<Product>({
      tableName: TABLE_NAMES.PRODUCTS,
      keyConditionExpression: 'productId = :productId',
      expressionAttributeValues: { ':productId': reqItem.productId },
      limit: 1,
    });
    const product = productItems[0] ?? null;

    if (product === null) {
      throw new AppError(
        ErrorCodes.PRODUCT_NOT_FOUND,
        `Product ${reqItem.productId} not found`,
        404
      );
    }

    const lineTotal = product.price * reqItem.quantity;
    subtotal += lineTotal;

    orderItems.push({
      productId: product.productId,
      name: product.name,
      brand: product.brand,
      quantity: reqItem.quantity,
      priceAtOrder: product.price,
      imageUrl: product.imageUrls[0] ?? '',
    });
  }

  const deliveryFee = 0; // hackathon: always free
  const total = subtotal + deliveryFee;

  const now = new Date();
  const etaAt = new Date(now.getTime() + HACKATHON_ETA_MINUTES * 60 * 1000).toISOString();
  const orderId = generateOrderId();

  const order: Order = {
    orderId,
    userId,
    status: 'PLACED' as OrderStatus,
    items: orderItems,
    subtotal,
    deliveryFee,
    total,
    pincode: request.pincode,
    addressId: request.addressId,
    darkStoreId: DEFAULT_DARK_STORE_ID,
    etaMinutes: HACKATHON_ETA_MINUTES,
    etaAt,
    paymentMethod: request.paymentMethod ?? 'amazon_pay',
    paymentStatus: 'COMPLETED',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Write to DynamoDB with duplicate-prevention guard
  try {
    await putItem<Record<string, unknown>>(
      TABLE_NAMES.ORDERS,
      order as unknown as Record<string, unknown>
    );
  } catch (error) {
    const err = error as Error & { name?: string };
    if (err.name === 'ConditionalCheckFailedException') {
      throw new AppError(ErrorCodes.DUPLICATE_ORDER, 'Duplicate order detected', 409);
    }
    throw error;
  }

  // Increment user totalOrders (fire-and-forget, log on failure)
  try {
    await updateItem(
      TABLE_NAMES.USERS,
      { userId },
      'SET totalOrders = if_not_exists(totalOrders, :zero) + :one',
      { ':one': 1, ':zero': 0 }
    );
  } catch (error) {
    logger.warn({ message: 'Failed to increment user totalOrders', userId, orderId, error });
  }

  // Invalidate smart cart cache
  try {
    await cacheAdapter.del('smartcart:' + userId);
  } catch (error) {
    logger.warn({ message: 'Failed to invalidate smart cart cache', userId, error });
  }

  logger.info({ message: 'Order placed', userId, orderId, total });

  return order;
}

// ============================================================================
// getOrder
// ============================================================================

/**
 * Get a single order by orderId, scoped to the requesting user.
 * Returns ORDER_NOT_FOUND (404) whether the order is absent or belongs to another user
 * (never returns 403 to avoid leaking existence).
 */
export async function getOrder(orderId: string, userId: string): Promise<Order> {
  // Orders table has composite key (userId PK + orderId SK) — need both keys for GetItem
  const order = await getItem<Order>(TABLE_NAMES.ORDERS, { userId, orderId });

  if (order === null || order.userId !== userId) {
    throw new AppError(ErrorCodes.ORDER_NOT_FOUND, 'Order not found', 404);
  }

  return order;
}

// ============================================================================
// getOrderHistory
// ============================================================================

/**
 * Get paginated order history for a user, sorted by orderId descending
 * (newest-first via ScanIndexForward: false).
 */
export async function getOrderHistory(
  userId: string,
  limit?: number,
  cursor?: string
): Promise<{ orders: Order[]; nextCursor?: string }> {
  const exclusiveStartKey = cursor
    ? (JSON.parse(Buffer.from(cursor, 'base64').toString()) as Record<string, unknown>)
    : undefined;

  const { items, nextCursor } = await queryItems<Order>({
    tableName: TABLE_NAMES.ORDERS,
    keyConditionExpression: 'userId = :userId',
    expressionAttributeValues: { ':userId': userId },
    // No indexName — userId is the base table PK, no GSI needed
    limit: limit ?? 20,
    exclusiveStartKey,
    scanIndexForward: false,
  });

  return { orders: items, nextCursor };
}

// ============================================================================
// getRecentOrders
// ============================================================================

/**
 * Get the 5 most recent orders for a user.
 */
export async function getRecentOrders(userId: string): Promise<Order[]> {
  const { orders } = await getOrderHistory(userId, 5);
  return orders;
}

// ============================================================================
// reorder
// ============================================================================

/**
 * Create a new order using the same items as an existing order.
 * The new order is placed via placeOrder, inheriting the same pincode and addressId.
 */
export async function reorder(orderId: string, userId: string): Promise<Order> {
  const existingOrder = await getOrder(orderId, userId);

  const request: OrderRequest = {
    items: existingOrder.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    pincode: existingOrder.pincode,
    addressId: existingOrder.addressId,
    paymentMethod: existingOrder.paymentMethod,
  };

  return placeOrder(userId, request);
}
