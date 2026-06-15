/**
 * Amazon Now Snap — DynamoSearchAdapter
 * 
 * Hackathon Mode Search Adapter using DynamoDB FilterExpression.
 * Replaces Amazon OpenSearch with zero cost.
 * 
 * Table: SnapSearchIndex
 * - PK: productId
 * - searchTokens (string, space-delimited lowercase tokens)
 * - category (string, for GSI filtering)
 * - brand (string)
 * - isAvailable (boolean)
 * 
 * GSI: CategoryIndex (PK: category, SK: productId)
 * 
 * Rules (from Rules.md § 13.3):
 * - Maximum query tokens: 5 (tokenize and take top 5 words by length)
 * - Always use CategoryIndex GSI if category filter is provided
 * - Never return more than 20 results
 * - Log 'searchMode: dynamo' for monitoring
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { SearchAdapter, SearchResult } from '../interfaces';
import { logger } from '@utils/logger';

export class DynamoSearchAdapter implements SearchAdapter {
  private readonly client: DynamoDBDocumentClient;
  private readonly searchIndexTable: string;
  private readonly productsTable: string;

  // Stop words to exclude from search tokens
  private readonly stopWords = new Set([
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
    'for',
    'of',
    'in',
    'on',
    'at',
    'to',
    'from',
    'with',
    'and',
    'or',
    'but',
  ]);

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-south-1',
      ...(process.env.DYNAMODB_ENDPOINT && {
        endpoint: process.env.DYNAMODB_ENDPOINT,
      }),
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient);

    const prefix = process.env.DYNAMODB_TABLE_PREFIX || 'Dev-';
    this.searchIndexTable = `${prefix}SnapSearchIndex`;
    this.productsTable = `${prefix}SnapProducts`;

    logger.info({
      message: 'DynamoSearchAdapter initialized',
      searchIndexTable: this.searchIndexTable,
      productsTable: this.productsTable,
      mode: 'hackathon',
    });
  }

  /**
   * Tokenize and normalize search query
   * Rules: lowercase, strip punctuation, remove stopwords, take top 5 by length
   */
  private tokenizeQuery(query: string): string[] {
    const tokens = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter((token) => token.length > 0)
      .filter((token) => !this.stopWords.has(token));

    // Sort by length descending and take top 5
    return tokens.sort((a, b) => b.length - a.length).slice(0, 5);
  }

  /**
   * Score a product based on token matches
   * Scoring: count of matching tokens
   */
  private scoreProduct(searchTokens: string[], productTokens: string): number {
    let score = 0;
    const productTokenSet = new Set(productTokens.split(' '));

    for (const searchToken of searchTokens) {
      if (productTokenSet.has(searchToken)) {
        score++;
      }
    }

    return score;
  }

  /**
   * Search for products by query and pincode
   */
  async search(
    query: string,
    _pincode: string,
    category?: string,
    limit: number = 20
  ): Promise<SearchResult[]> {
    try {
      const startTime = Date.now();
      const searchTokens = this.tokenizeQuery(query);

      logger.info({
        message: 'Search initiated',
        query,
        searchTokens,
        category,
        limit,
        adapter: 'DynamoSearch',
        searchMode: 'dynamo',
      });

      if (searchTokens.length === 0) {
        logger.warn({
          message: 'Empty search query after tokenization',
          originalQuery: query,
          adapter: 'DynamoSearch',
        });
        return [];
      }

      let items: any[] = [];

      // Use CategoryIndex GSI if category is provided
      if (category) {
        const command = new QueryCommand({
          TableName: this.searchIndexTable,
          IndexName: 'CategoryIndex',
          KeyConditionExpression: 'category = :category',
          ExpressionAttributeValues: {
            ':category': category,
          },
        });

        const response = await this.client.send(command);
        items = response.Items || [];
      } else {
        // Full table scan
        const command = new ScanCommand({
          TableName: this.searchIndexTable,
        });

        const response = await this.client.send(command);
        items = response.Items || [];
      }

      // Score and rank results — each item has a single 'token' attribute
      // Group by productId and count how many of the search tokens match
      const productScoreMap = new Map<string, { score: number; category: string; brand: string }>();
      
      for (const item of items) {
        const productId = item.productId as string;
        const itemToken = (item.token as string || '').toLowerCase();
        
        // Check if any search token matches this item's token
        const matches = searchTokens.filter(st => itemToken.includes(st) || st.includes(itemToken)).length;
        if (matches > 0) {
          const existing = productScoreMap.get(productId);
          if (existing) {
            existing.score += matches;
          } else {
            productScoreMap.set(productId, {
              score: matches,
              category: item.category as string,
              brand: item.brand as string,
            });
          }
        }
      }

      const scoredResults = Array.from(productScoreMap.entries())
        .map(([productId, data]) => ({ productId, ...data }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Fetch full product details from SnapProducts table
      const productIds = scoredResults.map((r) => r.productId);
      const productDetails = await this.fetchProductDetails(productIds);

      const results: SearchResult[] = (scoredResults
        .map((scoredItem) => {
          const product = productDetails.get(scoredItem.productId);
          if (!product) {
            return null;
          }

          return {
            productId: product.productId as string,
            name: product.name as string,
            brand: product.brand as string,
            category: product.category as string,
            subCategory: product.subCategory as string,
            price: product.price as number,
            mrp: product.mrp as number | undefined,
            imageUrl: (product.imageUrls?.[0] || '') as string,
            imageUrls: (product.imageUrls || []) as string[],
            tags: (product.tags || []) as string[],
            isAvailable: product.isAvailable !== false,
            score: scoredItem.score,
          } as SearchResult;
        })
        .filter(Boolean)) as SearchResult[];

      const duration = Date.now() - startTime;

      logger.info({
        message: 'Search completed',
        query,
        resultsFound: results.length,
        durationMs: duration,
        adapter: 'DynamoSearch',
        searchMode: 'dynamo',
      });

      return results;
    } catch (error) {
      logger.error({
        message: 'Search failed',
        query,
        category,
        error,
        adapter: 'DynamoSearch',
      });
      // Return empty array on error - don't break the request
      return [];
    }
  }

  /**
   * Get trending products for a pincode
   * Note: In Hackathon Mode, this returns a static set or random products
   * In real implementation, this would query SnapOrders aggregated by pincode
   */
  async getTrending(pincode: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      logger.info({
        message: 'Get trending products',
        pincode,
        limit,
        adapter: 'DynamoSearch',
        searchMode: 'dynamo',
      });

      // For Hackathon Mode: Return first N products (no isAvailable filter —
      // seed data does not include that attribute; all seeded items are available)
      // In production, this would aggregate SnapOrders by pincode + product
      const command = new ScanCommand({
        TableName: this.searchIndexTable,
        Limit: limit * 3, // Over-fetch to compensate for DynamoDB Limit applying before filter
      });

      const response = await this.client.send(command);
      const items = response.Items || [];

      const productIds = items.map((item) => item.productId as string);
      // Deduplicate product IDs — SnapSearchIndex can have multiple tokens per product
      const uniqueProductIds = [...new Set(productIds)];
      const productDetails = await this.fetchProductDetails(uniqueProductIds);

      const results: SearchResult[] = (uniqueProductIds
        .map((productId, index) => {
          const product = productDetails.get(productId);
          if (!product) {
            return null;
          }

          return {
            productId: product.productId as string,
            name: product.name as string,
            brand: product.brand as string,
            category: product.category as string,
            subCategory: product.subCategory as string,
            price: product.price as number,
            mrp: product.mrp as number | undefined,
            imageUrl: (product.imageUrls?.[0] || '') as string,
            imageUrls: (product.imageUrls || []) as string[],
            tags: (product.tags || []) as string[],
            isAvailable: product.isAvailable !== false,
            score: limit - index,
          } as SearchResult;
        })
        .filter(Boolean)) as SearchResult[];

      return results;
    } catch (error) {
      logger.error({
        message: 'Get trending failed',
        pincode,
        error,
        adapter: 'DynamoSearch',
      });
      return [];
    }
  }

  /**
   * Fetch full product details from SnapProducts table
   */
  private async fetchProductDetails(productIds: string[]): Promise<Map<string, any>> {
    const productMap = new Map<string, any>();

    if (productIds.length === 0) {
      return productMap;
    }

    try {
      // SnapProducts has a composite key (productId + sku), so GetCommand won't work
      // with productId alone. Use Query on the partition key instead — it returns all
      // SKUs for a product; we take the first one.
      const promises = productIds.map((productId) =>
        this.client.send(
          new QueryCommand({
            TableName: this.productsTable,
            KeyConditionExpression: 'productId = :pid',
            ExpressionAttributeValues: { ':pid': productId },
            Limit: 1,
          })
        )
      );

      const responses = await Promise.all(promises);

      for (const response of responses) {
        const item = response.Items?.[0];
        if (item) {
          productMap.set(item.productId as string, item);
        }
      }
    } catch (error) {
      logger.error({
        message: 'Failed to fetch product details',
        productCount: productIds.length,
        error,
        adapter: 'DynamoSearch',
      });
    }

    return productMap;
  }
}
