/**
 * Amazon Now Snap — Adapter Interfaces
 * 
 * These interfaces define the contracts for the dual deployment mode.
 * Each interface has two implementations:
 * - Hackathon Mode: Free-tier, rule-based (DynamoDB, no paid AI)
 * - Production Mode: Paid services (OpenSearch, Redis, Bedrock, etc.)
 * 
 * The factory.ts file selects the correct implementation based on ENABLE_* flags.
 */

// ============================================================================
// Search Adapter Interface
// ============================================================================

export interface SearchResult {
  productId: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  price: number;
  mrp?: number;
  imageUrl: string;
  imageUrls?: string[];
  tags: string[];
  isAvailable?: boolean;
  score: number;
}

export interface SearchAdapter {
  /**
   * Search for products by query and pincode
   * @param query - Search query string
   * @param pincode - User's pincode
   * @param category - Optional category filter
   * @param limit - Maximum results (default: 20)
   * @returns Array of matching products with scores
   */
  search(
    query: string,
    pincode: string,
    category?: string,
    limit?: number
  ): Promise<SearchResult[]>;

  /**
   * Get trending products for a pincode
   * @param pincode - User's pincode
   * @param limit - Maximum results (default: 10)
   */
  getTrending(pincode: string, limit?: number): Promise<SearchResult[]>;
}

// ============================================================================
// Cache Adapter Interface
// ============================================================================

export interface CacheAdapter {
  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds
   */
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  /**
   * Delete a key from cache
   * @param key - Cache key
   */
  del(key: string): Promise<void>;

  /**
   * Batch get multiple keys
   * @param keys - Array of cache keys
   */
  mget<T>(keys: string[]): Promise<Array<T | null>>;
}

// ============================================================================
// Recommendation Adapter Interface
// ============================================================================

export interface Recommendation {
  productId: string;
  name: string;
  brand: string;
  price: number;
  imageUrl: string;
  confidence: number;
  reason: string;
}

export interface RecommendationAdapter {
  /**
   * Get personalized recommendations for a user
   * @param userId - User ID
   * @param pincode - User's pincode
   * @param numResults - Number of recommendations (default: 8)
   * @returns Array of recommendations with confidence scores
   */
  getRecommendations(
    userId: string,
    pincode: string,
    numResults?: number
  ): Promise<Recommendation[]>;

  /**
   * Determine smart cart tier based on user order history
   * @param userId - User ID
   * @returns Tier level: 'trending' | 'hybrid' | 'personalize'
   */
  getSmartCartTier(userId: string): Promise<'trending' | 'hybrid' | 'personalize'>;
}

// ============================================================================
// Intent Resolution Adapter Interface
// ============================================================================

export interface IntentResult {
  productId: string;
  name: string;
  brand: string;
  price: number;
  imageUrl: string;
  confidence: number;
  reason: string;
  resolvedBy: 'photo' | 'voice' | 'text' | 'barcode' | 'none';
  alternatives?: Array<{
    productId: string;
    name: string;
    brand: string;
    price: number;
    imageUrl: string;
  }>;
  suggestedInput?: string; // For graceful failure with partial text
}

export interface IntentResolutionAdapter {
  /**
   * Resolve user intent from text input
   * @param transcript - User's text/voice transcript
   * @param pincode - User's pincode
   * @param userId - User ID (for personalization context)
   * @returns Intent resolution result
   */
  resolveIntent(
    transcript: string,
    pincode: string,
    userId: string
  ): Promise<IntentResult>;
}

// ============================================================================
// Vision Adapter Interface
// ============================================================================

export interface VisionResult {
  labels: Array<{ name: string; confidence: number }>;
  detectedText: Array<{ text: string; confidence: number }>;
  barcode?: string;
}

export interface VisionAdapter {
  /**
   * Analyze a product image
   * @param imageKey - S3 key for the image
   * @returns Detected labels, text, and barcode
   */
  analyzeImage(imageKey: string): Promise<VisionResult>;
}

// ============================================================================
// Voice Adapter Interface
// ============================================================================

export interface VoiceAdapter {
  /**
   * Transcribe audio to text
   * @param audioData - Audio stream or buffer
   * @param languageCode - Language code (e.g., 'en-IN', 'hi-IN')
   * @returns Transcribed text
   */
  transcribe(audioData: Buffer | string, languageCode: string): Promise<string>;
}
