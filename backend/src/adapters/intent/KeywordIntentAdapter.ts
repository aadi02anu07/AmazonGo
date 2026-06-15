/**
 * Amazon Now Snap — KeywordIntentAdapter
 * 
 * Hackathon Mode Intent Resolution Adapter using rule-based keyword matching.
 * Replaces Amazon Bedrock Claude with zero cost.
 * 
 * Algorithm:
 * 1. Barcode fast path: if barcode detected, call barcode lookup (confidence: 1.0)
 * 2. Keyword extraction: tokenize input, match against product fields
 * 3. Scoring: weighted match (name: 3×, brand: 2×, tags: 2×, category: 1×)
 * 4. Top result: return highest-scoring in-stock product
 * 5. Alternatives: if confidence < 0.75, return next 2 products
 * 
 * Confidence thresholds (from Rules.md § 3.7):
 * - ≥ 0.75: Return single product, alternatives: []
 * - 0.50–0.74: Return single product + up to 2 alternatives
 * - < 0.50: Return resolvedBy: "none" with suggestedInput
 * 
 * Rules (from Rules.md § 13.3):
 * - Always normalize tokens: lowercase, strip punctuation, remove stopwords
 * - Always return confidence as float 0–1
 * - Apply same thresholds as Bedrock
 * - Log 'intentMode: keyword' for monitoring
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { IntentResolutionAdapter, IntentResult } from '../interfaces';
import { logger } from '@utils/logger';

interface ScoredProduct {
  productId: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  imageUrl: string;
  score: number;
  maxScore: number;
}

export class KeywordIntentAdapter implements IntentResolutionAdapter {
  private readonly client: DynamoDBDocumentClient;
  private readonly productsTable: string;

  // Stop words to exclude from tokenization
  private readonly stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'for', 'of', 'in', 'on',
    'at', 'to', 'from', 'with', 'and', 'or', 'but', 'i', 'need', 'want',
    'get', 'buy', 'make', 'making', 'cook', 'cooking', 'some', 'me', 'my',
    'us', 'we', 'have', 'has', 'do', 'did', 'will', 'just', 'please',
    'tonight', 'today', 'now', 'quickly', 'fast', 'urgent', 'order',
  ]);

  /**
   * Synonym / intent expansion map.
   * Maps a word the user might say → product keywords that exist in the catalog.
   * Enables natural language queries like "pasta", "sick child", "upset stomach".
   */
  private readonly synonymMap: Record<string, string[]> = {
    // Food / recipe intent
    pasta:        ['noodles', 'maggi'],
    noodle:       ['noodles', 'maggi'],
    magi:         ['maggi', 'noodles'],
    instant:      ['maggi', 'noodles'],
    breakfast:    ['bread', 'milk', 'eggs', 'butter'],
    chai:         ['milk', 'tea'],
    tea:          ['milk'],
    roti:         ['atta', 'flour', 'wheat'],
    chapati:      ['atta', 'flour'],
    dosa:         ['rice', 'oil'],
    fry:          ['oil', 'butter'],
    bake:         ['flour', 'atta', 'butter', 'sugar'],
    dal:          ['toor', 'lentil'],
    curry:        ['oil', 'tomatoes', 'onions', 'salt'],
    sabzi:        ['tomatoes', 'onions', 'oil'],
    salad:        ['tomatoes', 'onions'],
    sandwich:     ['bread', 'butter'],
    omelette:     ['eggs', 'oil', 'butter'],
    boiled:       ['eggs'],
    khichdi:      ['rice', 'dal', 'toor'],
    biryani:      ['rice', 'oil', 'onions'],
    pulao:        ['rice'],
    juice:        ['tropicana', 'orange'],
    snack:        ['chips', 'lays', 'kurkure', 'biscuit'],
    munchies:     ['chips', 'kurkure', 'namkeen', 'haldirams'],
    sweet:        ['biscuit', 'cookies', 'sugar'],
    thirsty:      ['water', 'bisleri', 'juice', 'pepsi', 'coke'],
    hydrate:      ['water', 'bisleri', 'ors', 'electral'],
    // Health / medicine intent
    sick:         ['fever', 'paracetamol', 'crocin'],
    fever:        ['crocin', 'calpol', 'paracetamol'],
    cold:         ['vicks', 'strepsils', 'cough'],
    cough:        ['strepsils', 'vicks'],
    headache:     ['disprin', 'crocin', 'pain'],
    pain:         ['iodex', 'disprin', 'crocin'],
    stomach:      ['gelusil', 'antacid', 'digestion'],
    acidity:      ['gelusil', 'antacid'],
    dehydrated:   ['electral', 'ors'],
    wound:        ['betadine', 'antiseptic'],
    vitamin:      ['zincovit', 'multivitamin'],
    supplement:   ['zincovit', 'vitamin'],
    medicine:     ['crocin', 'fever', 'tablet'],
    tablet:       ['crocin', 'disprin', 'gelusil'],
    syrup:        ['calpol'],
    baby:         ['calpol', 'johnson', 'pampers'],
    child:        ['calpol', 'johnson'],
    // Household intent
    clean:        ['detergent', 'vim', 'lizol', 'colin'],
    wash:         ['detergent', 'surf', 'ariel'],
    laundry:      ['surf', 'ariel', 'detergent'],
    dishes:       ['vim', 'dishwash'],
    mosquito:     ['goodnight', 'repellent'],
    cockroach:    ['black flag', 'insecticide'],
    toilet:       ['harpic', 'tissue'],
    bathroom:     ['harpic', 'tissue', 'dettol'],
    floor:        ['lizol', 'phenyl'],
    glass:        ['colin'],
    // Personal care intent
    bath:         ['soap', 'dove', 'dettol'],
    shower:       ['soap', 'dove'],
    shampoo:      ['head shoulders', 'pantene', 'johnson'],
    hair:         ['shampoo', 'parachute', 'coconut'],
    teeth:        ['colgate', 'toothpaste'],
    brush:        ['colgate', 'toothpaste'],
    skin:         ['dove', 'nivea', 'vaseline', 'soap'],
    lotion:       ['vaseline', 'nivea'],
    moisturizer:  ['vaseline', 'nivea'],
    shave:        ['gillette'],
    diaper:       ['pampers'],
    // Common quantity/urgency words — map to most-bought items
    urgent:       ['crocin', 'fever', 'milk'],
    emergency:    ['crocin', 'fever', 'medicine'],
    running_out:  ['milk', 'eggs', 'bread'],
  };

  // Confidence thresholds
  private readonly CONFIDENCE_SINGLE_THRESHOLD = parseFloat(
    process.env.AI_CONFIDENCE_SINGLE_THRESHOLD || '0.75'
  );
  private readonly CONFIDENCE_ALTERNATIVES_THRESHOLD = parseFloat(
    process.env.AI_CONFIDENCE_ALTERNATIVES_THRESHOLD || '0.50'
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
    this.productsTable = `${prefix}SnapProducts`;

    logger.info({
      message: 'KeywordIntentAdapter initialized',
      productsTable: this.productsTable,
      mode: 'hackathon',
      intentMode: 'keyword',
    });
  }

  /**
   * Tokenize and normalize text
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter((token) => token.length > 1) // Remove single characters
      .filter((token) => !this.stopWords.has(token));
  }

  /**
   * Expand tokens with synonyms.
   * e.g. ["pasta"] → ["pasta", "noodles", "maggi"]
   * Deduplicates the result.
   */
  private expandWithSynonyms(tokens: string[]): string[] {
    const expanded = new Set<string>(tokens);
    for (const token of tokens) {
      const synonyms = this.synonymMap[token];
      if (synonyms) {
        for (const s of synonyms) {
          // synonyms may be multi-word (e.g. "head shoulders") — split and add each
          s.split(/\s+/).forEach((w) => expanded.add(w));
        }
      }
    }
    return Array.from(expanded);
  }

  /**
   * Calculate weighted match score for a product
   * Weights: name×3, brand×2, tags×2, category×1
   */
  private scoreProduct(tokens: string[], product: any): ScoredProduct {
    let score = 0;
    let maxScore = 0;

    const productNameTokens = this.tokenize(product.name || '');
    const productBrandTokens = this.tokenize(product.brand || '');
    const productTags = (product.tags || []).map((tag: string) => tag.toLowerCase());
    const productCategory = (product.category || '').toLowerCase();

    for (const token of tokens) {
      // Name matching (weight: 3)
      maxScore += 3;
      if (productNameTokens.some((nameToken) => nameToken.includes(token))) {
        score += 3;
      }

      // Brand matching (weight: 2)
      maxScore += 2;
      if (productBrandTokens.some((brandToken) => brandToken.includes(token))) {
        score += 2;
      }

      // Tags matching (weight: 2)
      maxScore += 2;
      if (productTags.some((tag: string) => tag.includes(token))) {
        score += 2;
      }

      // Category matching (weight: 1)
      maxScore += 1;
      if (productCategory.includes(token)) {
        score += 1;
      }
    }

    return {
      productId: product.productId,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price,
      imageUrl: product.imageUrls?.[0] || '',
      score,
      maxScore,
    };
  }

  /**
   * Resolve user intent from text input
   */
  async resolveIntent(
    transcript: string,
    pincode: string,
    userId: string
  ): Promise<IntentResult> {
    try {
      const startTime = Date.now();

      logger.info({
        message: 'Intent resolution initiated',
        transcript,
        pincode,
        userId,
        adapter: 'KeywordIntent',
        intentMode: 'keyword',
      });

      // Tokenize input and expand with synonyms
      const rawTokens = this.tokenize(transcript);
      const tokens = this.expandWithSynonyms(rawTokens);

      if (rawTokens.length === 0) {
        logger.warn({
          message: 'Empty intent after tokenization',
          transcript,
          adapter: 'KeywordIntent',
        });

        return {
          productId: '',
          name: '',
          brand: '',
          price: 0,
          imageUrl: '',
          confidence: 0,
          reason: 'Unable to understand the request',
          resolvedBy: 'none',
          suggestedInput: transcript,
        };
      }

      // Fetch all available products (in production, this would be cached or indexed)
      const command = new ScanCommand({
        TableName: this.productsTable,
        FilterExpression: 'isAvailable = :true',
        ExpressionAttributeValues: {
          ':true': true,
        },
      });

      const response = await this.client.send(command);
      const products = response.Items || [];

      if (products.length === 0) {
        logger.warn({
          message: 'No products available',
          adapter: 'KeywordIntent',
        });

        return {
          productId: '',
          name: '',
          brand: '',
          price: 0,
          imageUrl: '',
          confidence: 0,
          reason: 'No products available',
          resolvedBy: 'none',
        };
      }

      // Score all products
      const scoredProducts = products
        .map((product) => this.scoreProduct(tokens, product))
        .filter((sp) => sp.score > 0) // Only matches
        .sort((a, b) => {
          // Sort by normalized score (score/maxScore) descending
          const aNormalized = a.score / a.maxScore;
          const bNormalized = b.score / b.maxScore;
          return bNormalized - aNormalized;
        });

      if (scoredProducts.length === 0) {
        logger.info({
          message: 'No matching products found',
          tokens,
          adapter: 'KeywordIntent',
        });

        return {
          productId: '',
          name: '',
          brand: '',
          price: 0,
          imageUrl: '',
          confidence: 0,
          reason: 'No matching products found',
          resolvedBy: 'none',
          suggestedInput: transcript,
        };
      }

      // Calculate confidence for top result
      const topProduct = scoredProducts[0]!;
      const confidence = topProduct.score / topProduct.maxScore;

      const duration = Date.now() - startTime;

      logger.info({
        message: 'Intent resolution completed',
        transcript,
        topProductId: topProduct.productId,
        confidence,
        rawTokens,
        expandedTokens: tokens,
        durationMs: duration,
        adapter: 'KeywordIntent',
        intentMode: 'keyword',
      });

      // Build result based on confidence thresholds
      if (confidence >= this.CONFIDENCE_SINGLE_THRESHOLD) {
        // High confidence: single result, no alternatives
        return {
          productId: topProduct.productId,
          name: topProduct.name,
          brand: topProduct.brand,
          price: topProduct.price,
          imageUrl: topProduct.imageUrl,
          confidence,
          reason: `Matched query: "${transcript}"`,
          resolvedBy: 'text',
          alternatives: [],
        };
      } else if (confidence >= this.CONFIDENCE_ALTERNATIVES_THRESHOLD) {
        // Medium confidence: return with alternatives
        const alternatives = scoredProducts.slice(1, 3).map((sp) => ({
          productId: sp.productId,
          name: sp.name,
          brand: sp.brand,
          price: sp.price,
          imageUrl: sp.imageUrl,
        }));

        return {
          productId: topProduct.productId,
          name: topProduct.name,
          brand: topProduct.brand,
          price: topProduct.price,
          imageUrl: topProduct.imageUrl,
          confidence,
          reason: `Possible match for: "${transcript}"`,
          resolvedBy: 'text',
          alternatives,
        };
      } else {
        // Low confidence: graceful failure
        logger.info({
          message: 'Low confidence result',
          transcript,
          confidence,
          threshold: this.CONFIDENCE_ALTERNATIVES_THRESHOLD,
          adapter: 'KeywordIntent',
        });

        return {
          productId: '',
          name: '',
          brand: '',
          price: 0,
          imageUrl: '',
          confidence,
          reason: 'Low confidence match',
          resolvedBy: 'none',
          suggestedInput: tokens.join(' '),
        };
      }
    } catch (error) {
      logger.error({
        message: 'Intent resolution failed',
        transcript,
        error,
        adapter: 'KeywordIntent',
      });

      return {
        productId: '',
        name: '',
        brand: '',
        price: 0,
        imageUrl: '',
        confidence: 0,
        reason: 'Intent resolution failed',
        resolvedBy: 'none',
      };
    }
  }
}
