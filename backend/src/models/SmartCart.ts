/**
 * Amazon Now Snap — SmartCart Models
 *
 * Types for the Smart Cart recommendation feature.
 * Tiers align with RuleBasedRecommendationAdapter thresholds (Rules.md §13.3):
 *   trending   → 0–4 orders   → "Popular Near You"
 *   hybrid     → 5–19 orders  → "Based on Your Orders"
 *   personalize → 20+ orders  → "Your Smart Cart"
 */

export type SmartCartTier = 'trending' | 'hybrid' | 'personalize';

export interface Recommendation {
  productId: string;
  name: string;
  brand: string;
  /** Whole-integer paise value */
  price: number;
  imageUrl: string;
  confidence: number;
  reason: string;
}

export interface SmartCartResult {
  userId: string;
  pincode: string;
  tier: SmartCartTier;
  label: string;
  suggestions: Recommendation[];
  generatedAt: string; // ISO 8601 UTC
}

export interface PurchaseCadence {
  userId: string;
  productId: string;
  totalPurchases: number;
  avgIntervalDays: number;
  lastPurchasedAt: string;
  nextPredictedAt: string;
  purchaseDates: string[];
  ttl: number;
}
