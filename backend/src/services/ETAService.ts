/**
 * Amazon Now Snap — ETA Service
 *
 * Business-logic layer for delivery ETA calculations.
 * Queries DarkStore records to find the optimal store for a pincode,
 * then computes estimated delivery time = avgPickupMinutes + last-mile constant.
 *
 * Routes served:
 *   GET  /v1/eta?pincode=110001
 *   POST /v1/eta/batch
 *
 * Cache key format: eta:{pincode}  TTL: 60 seconds
 * Last-mile constant: 8 minutes (DEFAULT_LAST_MILE_MINUTES)
 */

import { scanItems, TABLE_NAMES } from '@clients/dynamoClient';
import { cacheAdapter } from '@adapters/factory';
import { logger } from '@utils/logger';
import { AppError, ErrorCodes } from '@constants/errors';
import { ETAResult, DarkStore } from '@models/ETA';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LAST_MILE_MINUTES = 8;
const ETA_CACHE_TTL_SECONDS = 60;

// ============================================================================
// Private helpers
// ============================================================================

/**
 * Scan SnapDarkStores for stores that service the given pincode.
 * Uses FilterExpression contains() since serviceablePincodes is a string set / list.
 */
async function findStoresForPincode(pincode: string): Promise<DarkStore[]> {
  return scanItems<DarkStore>({
    tableName: TABLE_NAMES.DARK_STORES,
    filterExpression: 'contains(serviceablePincodes, :pincode)',
    expressionAttributeValues: { ':pincode': pincode },
  });
}

// ============================================================================
// calculateETA
// ============================================================================

/**
 * Calculate ETA for a single pincode.
 *
 * 1. Check cache (eta:{pincode}) → return cached result on hit.
 * 2. Scan SnapDarkStores for stores that service the pincode.
 * 3. Throw PINCODE_NOT_SERVICEABLE (422) if no stores found.
 * 4. Filter operational stores; throw DARKSTORE_OFFLINE (503) if all offline.
 * 5. Select store with minimum avgPickupMinutes.
 * 6. Compute etaMinutes = avgPickupMinutes + DEFAULT_LAST_MILE_MINUTES.
 * 7. Cache the result for ETA_CACHE_TTL_SECONDS seconds.
 */
export async function calculateETA(pincode: string): Promise<ETAResult> {
  const cacheKey = `eta:${pincode}`;

  // Cache read (errors silently swallowed)
  let cached: ETAResult | null = null;
  try {
    cached = await cacheAdapter.get<ETAResult>(cacheKey);
  } catch (e) {
    logger.error({ message: 'Cache get error in calculateETA', error: e, pincode });
  }
  if (cached !== null) {
    return cached;
  }

  // Fetch matching dark stores
  const stores = await findStoresForPincode(pincode);

  if (stores.length === 0) {
    throw new AppError(
      ErrorCodes.PINCODE_NOT_SERVICEABLE,
      `Pincode ${pincode} is not serviceable`,
      422
    );
  }

  const operationalStores = stores.filter((s) => s.isOperational);

  if (operationalStores.length === 0) {
    throw new AppError(
      ErrorCodes.DARKSTORE_OFFLINE,
      'All dark stores serving this pincode are currently offline',
      503,
      true
    );
  }

  // Select store with minimum avgPickupMinutes (guaranteed non-empty by filter above)
  const bestStore = operationalStores.reduce((best, current) =>
    current.avgPickupMinutes < best.avgPickupMinutes ? current : best
  );

  const etaMinutes = bestStore.avgPickupMinutes + DEFAULT_LAST_MILE_MINUTES;
  const etaAt = new Date(Date.now() + etaMinutes * 60_000).toISOString();

  const etaResult: ETAResult = {
    etaMinutes,
    etaAt,
    darkStoreId: bestStore.darkStoreId,
    label: `Delivery in ${etaMinutes} minutes`,
  };

  // Cache write (errors silently swallowed)
  try {
    await cacheAdapter.set(cacheKey, etaResult, ETA_CACHE_TTL_SECONDS);
  } catch (e) {
    logger.error({ message: 'Cache set error in calculateETA', error: e, pincode });
  }

  return etaResult;
}

// ============================================================================
// batchCalculateETA
// ============================================================================

/**
 * Calculate ETA for multiple pincodes in parallel.
 * Individual errors are swallowed; only successful results are returned.
 */
export async function batchCalculateETA(pincodes: string[]): Promise<ETAResult[]> {
  const results = await Promise.allSettled(pincodes.map((pincode) => calculateETA(pincode)));

  const successful: ETAResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      logger.warn({
        message: 'batchCalculateETA: individual pincode failed',
        reason: String(result.reason),
      });
    }
  }

  return successful;
}
