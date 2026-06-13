/**
 * Amazon Now Snap — RuleBasedRecommendationAdapter
 * 
 * Hackathon Mode Recommendation Adapter using pure DynamoDB rule logic.
 * Replaces Amazon Personalize with zero cost.
 * 
 * Three-Tier Smart Cart Strategy:
 * - Tier 1 (0–4 orders): Trending products for pincode (label: "Popular Near You")
 * - Tier 2 (5–19 orders): Union of recent orders + trending (label: "Based on Your Orders")
 * - Tier 3 (20+ orders): Frequency ranking from PurchaseCadence (label: "Your Smart Cart")
 * 
 * Rules (from Rules.md § 13.3):
 * - Always read SnapUsers.totalOrders to determine tier before any query
 * - Tier 1 (< 5 orders): only query SnapCache/SnapProducts for trending data
 * - Tier 2 (5–19 orders): union of recent 10 orders + trending, deduplicated
 * - Tier 3 (20+ orders): frequency sort from SnapPurchaseCadence, top 10
 * - Always filter results to in-stock products via CacheAdapter
 * - Log 'recommendationMode: rule-based' and 'tier: 1|2|3'
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { RecommendationAdapter, Recommendation } from '../interfaces';
import { cacheAdapter } from '../factory';
import { logger } from '@utils/logger';

export class RuleBasedRecommendationAdapter implements RecommendationAdapter {
  private readonly client: DynamoDBDocumentClient;
  private readonly usersTable: string;
  private readonly ordersTable: string;
  private readonly productsTable: string;
  private readonly cadenceTable: string;

  // Tier thresholds
  private readonly TIER_1_MAX_ORDERS = parseInt(
    process.env.SMART_CART_TIER_1_MAX_ORDERS || '4',
    10
  );
  private readonly TIER_2_MAX_ORDERS = parseInt(
    process.env.SMART_CART_TIER_2_MAX_ORDERS || '19',
    10
  );
  private readonly TIER_3_MIN_ORDERS = parseInt(
    process.env.SMART_CART_TIER_3_MIN_ORDERS || '20',
    10
  );

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-south-1',
      ...(process.env.DYNAMODB_ENDPOINT && {
        endpoint: process.env.DYNAMODB_ENDPOINT,
      }),
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient);

    const prefix = process.env.DYNAMODB_TABLE_PREFIX || 'Dev-';
    this.usersTable = `${prefix}SnapUsers`;
    this.ordersTable = `${prefix}SnapOrders`;
    this.productsTable = `${prefix}SnapProducts`;
    this.cadenceTable = `${prefix}SnapPurchaseCadence`;

    logger.info({
      message: 'RuleBasedRecommendationAdapter initialized',
      mode: 'hackathon',
      recommendationMode: 'rule-based',
    });
  }

  /**
   * Determine smart cart tier based on user order history
   */
  async getSmartCartTier(userId: string): Promise<'trending' | 'hybrid' | 'personalize'> {
    try {
      const command = new GetCommand({
        TableName: this.usersTable,
        Key: { userId },
      });

      const response = await this.client.send(command);
      const user = response.Item;

      if (!user) {
        logger.warn({
          message: 'User not found for tier determination',
          userId,
          adapter: 'RuleBasedRecommendation',
        });
        return 'trending';
      }

      const totalOrders = (user.totalOrders as number) || 0;

      let tier: 'trending' | 'hybrid' | 'personalize';
      if (totalOrders <= this.TIER_1_MAX_ORDERS) {
        tier = 'trending';
      } else if (totalOrders <= this.TIER_2_MAX_ORDERS) {
        tier = 'hybrid';
      } else {
        tier = 'personalize';
      }

      logger.info({
        message: 'Smart cart tier determined',
        userId,
        totalOrders,
        tier,
        adapter: 'RuleBasedRecommendation',
      });

      // Update smartCartTier in user record for analytics
      // Note: This is a fire-and-forget update, not awaited
      this.updateUserTier(userId, tier).catch((error) => {
        logger.error({
          message: 'Failed to update user tier',
          userId,
          tier,
          error,
        });
      });

      return tier;
    } catch (error) {
      logger.error({
        message: 'Error determining smart cart tier',
        userId,
        error,
        adapter: 'RuleBasedRecommendation',
      });
      return 'trending'; // Default to trending on error
    }
  }

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(
    userId: string,
    pincode: string,
    numResults: number = 8
  ): Promise<Recommendation[]> {
    try {
      const startTime = Date.now();

      logger.info({
        message: 'Get recommendations initiated',
        userId,
        pincode,
        numResults,
        adapter: 'RuleBasedRecommendation',
        recommendationMode: 'rule-based',
      });

      // Determine tier
      const tier = await this.getSmartCartTier(userId);

      let recommendations: Recommendation[] = [];

      if (tier === 'trending') {
        // Tier 1: Trending products
        recommendations = await this.getTier1Recommendations(pincode, numResults);
      } else if (tier === 'hybrid') {
        // Tier 2: Recent orders + trending
        recommendations = await this.getTier2Recommendations(userId, pincode, numResults);
      } else {
        // Tier 3: Frequency-based from purchase cadence
        recommendations = await this.getTier3Recommendations(userId, pincode, numResults);
      }

      // Filter to in-stock products
      const inStockRecommendations = await this.filterInStock(recommendations, pincode);

      const duration = Date.now() - startTime;

      logger.info({
        message: 'Get recommendations completed',
        userId,
        tier,
        totalRecommendations: recommendations.length,
        inStockRecommendations: inStockRecommendations.length,
        durationMs: duration,
        adapter: 'RuleBasedRecommendation',
        recommendationMode: 'rule-based',
      });

      return inStockRecommendations.slice(0, numResults);
    } catch (error) {
      logger.error({
        message: 'Get recommendations failed',
        userId,
        pincode,
        error,
        adapter: 'RuleBasedRecommendation',
      });
      return [];
    }
  }

  /**
   * Tier 1: Get trending products (0-4 orders)
   */
  private async getTier1Recommendations(
    pincode: string,
    numResults: number
  ): Promise<Recommendation[]> {
    logger.info({
      message: 'Getting Tier 1 recommendations (trending)',
      pincode,
      tier: 1,
    });

    // Check cache first
    const cacheKey = `trending:${pincode}`;
    const cached = await cacheAdapter.get<Recommendation[]>(cacheKey);

    if (cached) {
      logger.debug({
        message: 'Trending recommendations cache hit',
        pincode,
        tier: 1,
      });
      return cached;
    }

    // In production, this would aggregate SnapOrders by pincode
    // For Hackathon: return first N available products
    const command = new ScanCommand({
      TableName: this.productsTable,
      FilterExpression: 'isAvailable = :true',
      ExpressionAttributeValues: {
        ':true': true,
      },
      Limit: numResults * 2, // Get more than needed for stock filtering
    });

    const response = await this.client.send(command);
    const products = response.Items || [];

    const recommendations: Recommendation[] = products.map((product, index) => ({
      productId: product.productId as string,
      name: product.name as string,
      brand: product.brand as string,
      price: product.price as number,
      imageUrl: (product.imageUrls as string[])?.[0] || '',
      confidence: 0.8 - index * 0.05, // Decreasing confidence
      reason: 'Popular in your area',
    }));

    // Cache for 15 minutes
    await cacheAdapter.set(cacheKey, recommendations, 900);

    return recommendations;
  }

  /**
   * Tier 2: Get hybrid recommendations (5-19 orders)
   * Union of recent 10 orders + trending
   */
  private async getTier2Recommendations(
    userId: string,
    pincode: string,
    numResults: number
  ): Promise<Recommendation[]> {
    logger.info({
      message: 'Getting Tier 2 recommendations (hybrid)',
      userId,
      pincode,
      tier: 2,
    });

    // Get user's recent orders
    const recentProducts = await this.getRecentOrderProducts(userId, 10);

    // Get trending products
    const trendingRecommendations = await this.getTier1Recommendations(pincode, numResults);

    // Deduplicate (prioritize recent orders)
    const recentProductIds = new Set(recentProducts.map((p) => p.productId));
    const deduplicatedTrending = trendingRecommendations.filter(
      (rec) => !recentProductIds.has(rec.productId)
    );

    // Blend: 50% recent, 50% trending
    const halfResults = Math.ceil(numResults / 2);
    const blended = [
      ...recentProducts.slice(0, halfResults),
      ...deduplicatedTrending.slice(0, numResults - halfResults),
    ];

    return blended;
  }

  /**
   * Tier 3: Get personalized recommendations (20+ orders)
   * Frequency ranking from SnapPurchaseCadence
   */
  private async getTier3Recommendations(
    userId: string,
    pincode: string,
    numResults: number
  ): Promise<Recommendation[]> {
    logger.info({
      message: 'Getting Tier 3 recommendations (frequency-based)',
      userId,
      pincode,
      tier: 3,
    });

    // Query purchase cadence table
    const command = new QueryCommand({
      TableName: this.cadenceTable,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });

    const response = await this.client.send(command);
    const cadenceItems = response.Items || [];

    // Sort by total purchases descending
    cadenceItems.sort((a, b) => (b.totalPurchases as number) - (a.totalPurchases as number));

    // Fetch product details
    const recommendations: Recommendation[] = [];
    for (const cadenceItem of cadenceItems.slice(0, numResults * 2)) {
      const productCommand = new GetCommand({
        TableName: this.productsTable,
        Key: { productId: cadenceItem.productId },
      });

      const productResponse = await this.client.send(productCommand);
      const product = productResponse.Item;

      if (product && product.isAvailable) {
        recommendations.push({
          productId: product.productId as string,
          name: product.name as string,
          brand: product.brand as string,
          price: product.price as number,
          imageUrl: (product.imageUrls as string[])?.[0] || '',
          confidence: 0.9,
          reason: `You buy this regularly (${cadenceItem.totalPurchases} times)`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Get recent order products for a user
   */
  private async getRecentOrderProducts(
    userId: string,
    limit: number
  ): Promise<Recommendation[]> {
    const command = new QueryCommand({
      TableName: this.ordersTable,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });

    const response = await this.client.send(command);
    const orders = response.Items || [];

    // Extract unique products from orders
    const productIds = new Set<string>();
    const productMap = new Map<string, any>();

    for (const order of orders) {
      const items = (order.items as any[]) || [];
      for (const item of items) {
        if (!productIds.has(item.productId)) {
          productIds.add(item.productId);
          productMap.set(item.productId, item);
        }
      }
    }

    // Convert to recommendations
    return Array.from(productMap.values()).map((item) => ({
      productId: item.productId,
      name: item.name,
      brand: item.brand || '',
      price: item.priceAtOrder,
      imageUrl: item.imageUrl || '',
      confidence: 0.85,
      reason: 'You ordered this recently',
    }));
  }

  /**
   * Filter recommendations to only in-stock products
   */
  private async filterInStock(
    recommendations: Recommendation[],
    pincode: string
  ): Promise<Recommendation[]> {
    if (recommendations.length === 0) {
      return [];
    }

    // Build cache keys for batch check
    const cacheKeys = recommendations.map((rec) => `inv:${pincode}:${rec.productId}`);

    // Batch check inventory via cache
    const inventoryStates = await cacheAdapter.mget<{ isAvailableFor10Min: boolean }>(cacheKeys);

    // Filter to in-stock only
    const inStock = recommendations.filter((rec, index) => {
      const inventoryState = inventoryStates[index];
      return inventoryState?.isAvailableFor10Min === true;
    });

    logger.debug({
      message: 'Filtered recommendations to in-stock',
      total: recommendations.length,
      inStock: inStock.length,
      pincode,
    });

    return inStock;
  }

  /**
   * Update user's smart cart tier (fire-and-forget)
   */
  private async updateUserTier(
    userId: string,
    tier: 'trending' | 'hybrid' | 'personalize'
  ): Promise<void> {
    try {
      const command = new GetCommand({
        TableName: this.usersTable,
        Key: { userId },
      });

      // Note: In a real implementation, this would use UpdateCommand
      // For now, we just log the update
      logger.debug({
        message: 'Smart cart tier update queued',
        userId,
        tier,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to update smart cart tier',
        userId,
        tier,
        error,
      });
    }
  }
}
