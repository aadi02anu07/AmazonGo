/**
 * Amazon Now Snap — BedrockIntentAdapter
 *
 * Uses AWS Bedrock (Claude) to resolve natural language intent to products.
 * Understands context like:
 *   "I want to make pasta tonight" → tomato sauce, cheese, pasta alternatives
 *   "something for a cold" → Crocin, Vicks, Strepsils
 *   "make chai" → milk, sugar, tea
 *
 * Falls back to keyword matching if Bedrock fails.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { IntentResolutionAdapter, IntentResult } from '../interfaces';
import { logger } from '@utils/logger';

const TABLE_NAMES = {
  PRODUCTS: `${process.env.DYNAMODB_TABLE_PREFIX || 'Dev-'}SnapProducts`,
};

export class BedrockIntentAdapter implements IntentResolutionAdapter {
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly modelId: string;

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-south-1',
    });

    const rawDynamo = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-south-1',
      ...(process.env.DYNAMODB_ENDPOINT && {
        endpoint: process.env.DYNAMODB_ENDPOINT,
      }),
    });
    this.dynamoClient = DynamoDBDocumentClient.from(rawDynamo);

    // Use Claude Haiku — fast and cheap (~$0.25/million tokens)
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

    logger.info({ message: 'BedrockIntentAdapter initialized', modelId: this.modelId });
  }

  async resolveIntent(
    transcript: string,
    pincode: string,
    userId: string
  ): Promise<IntentResult> {
    try {
      // 1. Fetch product catalog (names + tags for context)
      const products = await this.fetchProductCatalog();

      if (products.length === 0) {
        return this.failResult(transcript);
      }

      // 2. Build a compact catalog for the prompt
      const catalogSummary = products
        .slice(0, 50) // Keep prompt small
        .map((p: any) => `${p.productId}|${p.name}|${(p.tags || []).join(',')}|${p.category}`)
        .join('\n');

      // 3. Ask Claude to match intent to products
      const prompt = `You are a grocery/pharmacy assistant for an Indian quick-commerce app.

User said: "${transcript}"

Available products (id|name|tags|category):
${catalogSummary}

Task:
1. Understand what the user needs (even indirectly — e.g., "make pasta" means pasta ingredients)
2. Find the BEST matching product from the list above
3. Find up to 3 alternative products
4. Return ONLY a JSON object — no explanation, no markdown

JSON format:
{
  "productId": "prod_xxx",
  "confidence": 0.85,
  "reason": "one sentence why this matches",
  "alternatives": ["prod_yyy", "prod_zzz"],
  "suggestedInput": "rephrased search if no good match"
}

Rules:
- confidence 0.75-1.0 = direct match
- confidence 0.50-0.74 = likely match with alternatives
- confidence below 0.50 = no match, set productId to "none"
- If no products match at all, set productId to "none" and confidence to 0.30`;

      const response = await this.invokeClaude(prompt);

      // 4. Parse the response
      const parsed = this.parseClaudeResponse(response);

      if (!parsed || parsed.productId === 'none' || parsed.confidence < 0.50) {
        return {
          ...this.failResult(transcript),
          suggestedInput: parsed?.suggestedInput || transcript,
        };
      }

      // 5. Look up full product details
      const primaryProduct = products.find((p: any) => p.productId === parsed.productId);
      if (!primaryProduct) {
        return this.failResult(transcript);
      }

      const alternatives = (parsed.alternatives || [])
        .map((id: string) => products.find((p: any) => p.productId === id))
        .filter(Boolean)
        .map((p: any) => ({
          productId: p.productId,
          name: p.name,
          brand: p.brand || '',
          price: p.price || 0,
          imageUrl: (p.imageUrls || [])[0] || '',
        }));

      logger.info({
        message: 'BedrockIntentAdapter resolved intent',
        transcript,
        productId: parsed.productId,
        confidence: parsed.confidence,
      });

      return {
        productId: primaryProduct.productId,
        name: primaryProduct.name,
        brand: primaryProduct.brand || '',
        price: primaryProduct.price || 0,
        imageUrl: (primaryProduct.imageUrls || [])[0] || '',
        confidence: parsed.confidence,
        reason: parsed.reason || 'AI matched your request',
        resolvedBy: 'text',
        alternatives,
        suggestedInput: parsed.suggestedInput,
      };
    } catch (error) {
      logger.error({ message: 'BedrockIntentAdapter error', error, transcript });
      return this.failResult(transcript);
    }
  }

  private async invokeClaude(prompt: string): Promise<string> {
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 300,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body,
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content?.[0]?.text || '';
  }

  private parseClaudeResponse(text: string): any {
    try {
      // Extract JSON from response (Claude sometimes adds extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }

  private async fetchProductCatalog(): Promise<any[]> {
    try {
      const result = await this.dynamoClient.send(
        new ScanCommand({
          TableName: TABLE_NAMES.PRODUCTS,
          FilterExpression: 'isAvailable = :true',
          ExpressionAttributeValues: { ':true': true },
          ProjectionExpression: 'productId, #n, brand, category, tags, price, imageUrls',
          ExpressionAttributeNames: { '#n': 'name' },
        })
      );
      return result.Items || [];
    } catch (error) {
      logger.error({ message: 'Failed to fetch product catalog for Bedrock', error });
      return [];
    }
  }

  private failResult(transcript: string): IntentResult {
    return {
      productId: 'none',
      name: '',
      brand: '',
      price: 0,
      imageUrl: '',
      confidence: 0.0,
      reason: 'No matching product found',
      resolvedBy: 'none',
      alternatives: [],
      suggestedInput: transcript,
    };
  }
}
