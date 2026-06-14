/**
 * Amazon Now Snap — Inventory Service
 *
 * Business-logic layer for inventory checks and soft reservations.
 * Delegates all AWS SDK access to dynamoClient helpers.
 *
 * Routes served:
 *   GET  /v1/inventory/{pincode}/{productId}  — checkStock
 *   POST /v1/inventory/batch-check            — batchCheckStock
 *
 * Cache key pattern : inv:{pincode}:{productId}   TTL: 30 s
 * DynamoDB PK       : pincodeProductId = "{pincode}#{productId}"
 */

import { getItem, updateItem, TABLE_NAMES } from '@clients/dynamoClient';
import { cacheAdapter } from '@adapters/factory';
import { logger } from '@utils/logger';
import { AppError, ErrorCodes } from '@constants/errors';
import { InventoryRecord, InventoryStatus, QuantitySchema } from '@models/Inventory';

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL_SECONDS = 30;
const RESERVATION_TTL_SECONDS = 90;

// ============================================================================
// Private Helpers
// ============================================================================

function buildCacheKey(pincode: string, productId: string): string {
  return `inv:${pincode}:${productId}`;
}

function buildPK(pincode: string, productId: string): string {
  return `${pincode}#${productId}`;
}

function toInventoryStatus(record: InventoryRecord): InventoryStatus {
  return {
    productId: record.productId,
    pincode: record.pincode,
    isAvailableFor10Min: record.isAvailableFor10Min,
    stockLevel: record.stockLevel,
    darkStoreId: record.darkStoreId,
  };
}

function expiresAtISO(): string {
  return new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000).toISOString();
}

async function invalidateCache(pincode: string, productId: string): Promise<void> {
  try {
    await cacheAdapter.del(buildCacheKey(pincode, productId));
  } catch (e) {
    logger.warn({ message: 'Cache invalidation failed (non-fatal)', error: e, pincode, productId });
  }
}

// ============================================================================
// checkStock
// ============================================================================

/**
 * Return the inventory status for a single product+pincode.
 * Cache-first with 30-second TTL.
 * Throws OUT_OF_STOCK (422) when isAvailableFor10Min is false.
 * Throws STOCK_CHECK_FAILED (500) on DynamoDB errors.
 */
export async function checkStock(
  pincode: string,
  productId: string
): Promise<InventoryStatus> {
  const cacheKey = buildCacheKey(pincode, productId);

  const cached = await tryGetCache<InventoryStatus>(cacheKey);
  if (cached !== null) return cached;

  const record = await fetchInventoryRecord(pincode, productId);

  if (!record.isAvailableFor10Min) {
    throw new AppError(ErrorCodes.OUT_OF_STOCK, `Product ${productId} is out of stock`, 422);
  }

  const status = toInventoryStatus(record);
  await trySetCache(cacheKey, status, CACHE_TTL_SECONDS);
  return status;
}

// ============================================================================
// batchCheckStock
// ============================================================================

/**
 * Check inventory for multiple productIds at a given pincode in parallel.
 * Errors for individual products are caught and excluded from the result.
 */
export async function batchCheckStock(
  pincode: string,
  productIds: string[]
): Promise<InventoryStatus[]> {
  const results = await Promise.all(
    productIds.map((productId) =>
      checkStock(pincode, productId).catch((err: unknown) => {
        logger.warn({ message: 'batchCheckStock item error', pincode, productId, error: err });
        return null;
      })
    )
  );
  return results.filter((r): r is InventoryStatus => r !== null);
}

// ============================================================================
// softReserve
// ============================================================================

/**
 * Atomically increment reservedUnits for a product if stockLevel > reservedUnits.
 * Validates quantity is between 1 and 99.
 * Throws INVALID_QUANTITY (400) for bad quantity.
 * Throws RESERVATION_FAILED (422) on conditional check failure.
 * Invalidates cache on success.
 */
export async function softReserve(
  pincode: string,
  productId: string,
  userId: string,
  quantity: number
): Promise<void> {
  const parsed = QuantitySchema.safeParse(quantity);
  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.INVALID_QUANTITY,
      parsed.error.errors[0]?.message ?? 'Invalid quantity',
      400
    );
  }

  const key = { pincodeProductId: buildPK(pincode, productId) };
  const updateExpression = 'SET reservedUnits = reservedUnits + :qty, reservationExpiresAt = :exp';
  const expressionAttributeValues = { ':qty': parsed.data, ':exp': expiresAtISO(), ':zero': 0 };
  const conditionExpression = 'stockLevel > reservedUnits AND attribute_exists(pincodeProductId)';

  await runConditionalUpdate(
    key,
    updateExpression,
    expressionAttributeValues,
    conditionExpression,
    userId
  );
  await invalidateCache(pincode, productId);
}

// ============================================================================
// releaseReservation
// ============================================================================

/**
 * Decrement reservedUnits (floor 0) when a reservation is released.
 * Invalidates cache on success.
 */
export async function releaseReservation(
  pincode: string,
  productId: string,
  quantity: number
): Promise<void> {
  const key = { pincodeProductId: buildPK(pincode, productId) };
  const updateExpression =
    'SET reservedUnits = if_not_exists(reservedUnits, :zero) - :qty';
  const expressionAttributeValues = { ':qty': quantity, ':zero': 0 };

  try {
    await updateItem(
      TABLE_NAMES.INVENTORY,
      key,
      updateExpression,
      expressionAttributeValues
    );
  } catch (error) {
    logger.error({ message: 'releaseReservation updateItem failed', pincode, productId, error });
    throw error;
  }

  await invalidateCache(pincode, productId);
}

// ============================================================================
// Internal helpers (keep public functions ≤50 lines)
// ============================================================================

async function tryGetCache<T>(key: string): Promise<T | null> {
  try {
    return await cacheAdapter.get<T>(key);
  } catch (e) {
    logger.warn({ message: 'Cache get error (non-fatal)', error: e });
    return null;
  }
}

async function trySetCache<T>(key: string, value: T, ttl: number): Promise<void> {
  try {
    await cacheAdapter.set(key, value, ttl);
  } catch (e) {
    logger.warn({ message: 'Cache set error (non-fatal)', error: e });
  }
}

async function fetchInventoryRecord(
  pincode: string,
  productId: string
): Promise<InventoryRecord> {
  try {
    const record = await getItem<InventoryRecord>(TABLE_NAMES.INVENTORY, {
      pincodeProductId: buildPK(pincode, productId),
    });
    if (record === null) {
      throw new AppError(
        ErrorCodes.OUT_OF_STOCK,
        `Product ${productId} not found in inventory for pincode ${pincode}`,
        422
      );
    }
    return record;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ message: 'fetchInventoryRecord failed', pincode, productId, error: err });
    throw new AppError(ErrorCodes.STOCK_CHECK_FAILED, 'Stock check failed', 500, true);
  }
}

async function runConditionalUpdate(
  key: Record<string, unknown>,
  updateExpression: string,
  expressionAttributeValues: Record<string, unknown>,
  conditionExpression: string,
  userId: string
): Promise<void> {
  try {
    await updateItem(
      TABLE_NAMES.INVENTORY,
      key,
      updateExpression,
      expressionAttributeValues,
      undefined,
      conditionExpression
    );
  } catch (err) {
    if (isConditionalCheckFailed(err)) {
      throw new AppError(ErrorCodes.RESERVATION_FAILED, 'Reservation failed: insufficient stock', 422);
    }
    logger.error({ message: 'softReserve updateItem failed', userId, error: err });
    throw err;
  }
}

function isConditionalCheckFailed(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as Error & { name?: string }).name;
    return (
      code === 'ConditionalCheckFailedException' ||
      err.message.includes('ConditionalCheckFailedException')
    );
  }
  return false;
}
