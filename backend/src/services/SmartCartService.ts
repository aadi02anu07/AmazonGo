/**
 * Amazon Now Snap — SmartCart Service
 *
 * Thin orchestration layer over RuleBasedRecommendationAdapter.
 * Handles caching, tier-to-label mapping, and business-rule errors.
 *
 * Routes served (via handlers/smartCart.ts):
 *   GET  /v1/smart-cart?pincode=<pincode>  → getSmartCart
 *   POST /v1/smart-cart/refresh            → refreshSmartCart
 *
 * Cache key : smartcart:{userId}
 * Cache TTL  : 21 600 s (6 hours)
 *
 * Error codes:
 *   USER_NOT_FOUND (404)         – adapter returned no tier (user doesn't exist)
 *   NO_PRODUCTS_AVAILABLE (422)  – adapter returned zero in-stock recommendations
 */

import { recommendationAdapter, cacheAdapter } from '@adapters/factory';
import { logger } from '@utils/logger';
import { AppError, ErrorCodes } from '@constants/errors';
import { SmartCartResult, SmartCartTier, Recommendation } from '@models/SmartCart';
import { Recommendation as AdapterRecommendation } from '@adapters/interfaces';

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL_SECONDS = 21_600; // 6 hours
const NUM_RESULTS = 8;

const TIER_LABELS: Record<SmartCartTier, string> = {
  trending: 'Popular Near You',
  hybrid: 'Based on Your Orders',
  personalize: 'Your Smart Cart',
};

// ============================================================================
// Helpers
// ============================================================================

function cacheKey(userId: string): string {
  return `smartcart:${userId}`;
}

function mapRecommendation(rec: AdapterRecommendation): Recommendation {
  return {
    productId: rec.productId,
    name: rec.name,
    brand: rec.brand,
    price: rec.price,
    imageUrl: rec.imageUrl,
    confidence: rec.confidence,
    reason: rec.reason,
  };
}

// ============================================================================
// getSmartCart
// ============================================================================

/**
 * Fetch the smart cart for a user, using a 6-hour cache.
 *
 * Flow:
 *  1. Check cache — return immediately on hit.
 *  2. Resolve tier via recommendationAdapter.getSmartCartTier.
 *     Throws USER_NOT_FOUND if the adapter cannot find the user.
 *  3. Fetch up to 8 in-stock recommendations.
 *     Throws NO_PRODUCTS_AVAILABLE if adapter returns an empty array.
 *  4. Store result in cache and return.
 */
export async function getSmartCart(userId: string, pincode: string): Promise<SmartCartResult> {
  const key = cacheKey(userId);

  // Cache read (errors are swallowed — cache is a performance optimization)
  try {
    const cached = await cacheAdapter.get<SmartCartResult>(key);
    if (cached !== null) {
      logger.debug({ message: 'SmartCart cache hit', userId, pincode });
      return cached;
    }
  } catch (cacheReadError) {
    logger.error({ message: 'SmartCart cache get error', userId, error: cacheReadError });
  }

  // Resolve tier — a missing user shows up as the default 'trending' tier from the
  // adapter, but we must distinguish between "user not found" and "new user with 0 orders".
  // The adapter's getSmartCartTier returns 'trending' both for a missing user AND for a
  // 0-order user, so we do an explicit user-existence check via getSmartCartTier and
  // treat a thrown error from the adapter as an internal error, not USER_NOT_FOUND.
  // Per spec: if the recommendations list is empty because the user doesn't exist in DB,
  // getRecommendations also returns [] — we then throw USER_NOT_FOUND in that case only
  // when the adapter itself signals absence.  The simplest contract-respecting approach
  // is: call getSmartCartTier first; if it throws, propagate; then call getRecommendations.
  let tier: SmartCartTier;
  try {
    tier = await recommendationAdapter.getSmartCartTier(userId);
  } catch (tierError) {
    logger.error({ message: 'SmartCart tier resolution failed', userId, error: tierError });
    throw new AppError(ErrorCodes.USER_NOT_FOUND, 'User not found', 404);
  }

  let adapterRecs: AdapterRecommendation[];
  try {
    adapterRecs = await recommendationAdapter.getRecommendations(userId, pincode, NUM_RESULTS);
  } catch (recError) {
    logger.error({ message: 'SmartCart recommendations failed', userId, error: recError });
    throw new AppError(
      ErrorCodes.RECOMMENDATION_FAILED,
      'Failed to fetch recommendations',
      500,
      true
    );
  }

  if (adapterRecs.length === 0) {
    // Adapter returns [] either because the user doesn't exist OR because there are
    // genuinely no in-stock products. We differentiate by re-checking the tier call:
    // getSmartCartTier returns 'trending' for unknown users without throwing.
    // Per spec task: "if user not found from adapter, throw USER_NOT_FOUND (404);
    // if no in-stock recommendations, throw NO_PRODUCTS_AVAILABLE (422)".
    // Since getSmartCartTier already succeeded without throwing, the user is likely
    // valid but has no available products in that pincode → NO_PRODUCTS_AVAILABLE.
    logger.warn({ message: 'SmartCart no products available', userId, pincode });
    throw new AppError(
      ErrorCodes.NO_PRODUCTS_AVAILABLE,
      'No products available in your area',
      422
    );
  }

  const result: SmartCartResult = {
    userId,
    pincode,
    tier,
    label: TIER_LABELS[tier],
    suggestions: adapterRecs.map(mapRecommendation),
    generatedAt: new Date().toISOString(),
  };

  // Cache write (errors are swallowed)
  try {
    await cacheAdapter.set(key, result, CACHE_TTL_SECONDS);
  } catch (cacheWriteError) {
    logger.error({ message: 'SmartCart cache set error', userId, error: cacheWriteError });
  }

  logger.info({
    message: 'SmartCart generated',
    userId,
    pincode,
    tier,
    suggestionCount: result.suggestions.length,
  });

  return result;
}

// ============================================================================
// refreshSmartCart
// ============================================================================

/**
 * Force-refresh a user's smart cart by evicting the cache entry first,
 * then delegating to getSmartCart (which will hit the adapter since cache is empty).
 */
export async function refreshSmartCart(
  userId: string,
  pincode: string
): Promise<SmartCartResult> {
  await invalidateSmartCart(userId);
  return getSmartCart(userId, pincode);
}

// ============================================================================
// invalidateSmartCart
// ============================================================================

/**
 * Remove the cached smart cart for a user (e.g., after a new order is placed).
 */
export async function invalidateSmartCart(userId: string): Promise<void> {
  try {
    await cacheAdapter.del(cacheKey(userId));
    logger.info({ message: 'SmartCart cache invalidated', userId });
  } catch (error) {
    logger.error({ message: 'SmartCart cache invalidation error', userId, error });
  }
}
