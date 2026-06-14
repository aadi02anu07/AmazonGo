/**
 * Amazon Now Snap — Products Lambda Handlers
 *
 * Routes:
 *   GET /v1/products/{productId}         - getProduct
 *   GET /v1/products/search              - searchProductsHandler
 *   GET /v1/products/trending            - getTrendingHandler
 *   GET /v1/products/barcode/{code}      - getBarcodeHandler
 *
 * Auth: JWT Bearer token required. userId extracted exclusively from
 *       event.requestContext.authorizer?.jwt?.claims?.sub
 *
 * Model: @models/Product
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import type { APIGatewayEventRequestContextV2 } from 'aws-lambda';
import { z } from 'zod';
import { getProductById, searchProducts, getTrendingProducts, getProductByBarcode } from '@services/ProductService';
import { response } from '@utils/response';
import { logger } from '@utils/logger';
import { AppError } from '@constants/errors';

/** Narrow helper — extracts the JWT sub claim from the Cognito authorizer context */
function getUserId(requestContext: APIGatewayEventRequestContextV2): string | undefined {
  const ctx = requestContext as APIGatewayEventRequestContextV2 & {
    authorizer?: { jwt?: { claims?: Record<string, string> } };
  };
  return ctx.authorizer?.jwt?.claims?.['sub'];
}

export const getProduct: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext);
  const requestId = event.requestContext.requestId;

  const schema = z.object({ productId: z.string().min(1) });
  const parsed = schema.safeParse(event.pathParameters ?? {});
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const product = await getProductById(parsed.data.productId);
    return response.success(product);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error', error, requestId, userId });
    return response.internalError();
  }
};

export const searchProductsHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext);
  const requestId = event.requestContext.requestId;

  const schema = z.object({
    q: z.string().min(1).max(200),
    pincode: z.string().regex(/^\d{6}$/),
    category: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  });
  const parsed = schema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const results = await searchProducts(
      parsed.data.q,
      parsed.data.pincode,
      parsed.data.category,
      parsed.data.limit
    );
    return response.success({ results, count: results.length });
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error', error, requestId, userId });
    return response.internalError();
  }
};

export const getTrendingHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext);
  const requestId = event.requestContext.requestId;

  const schema = z.object({ pincode: z.string().regex(/^\d{6}$/) });
  const parsed = schema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const products = await getTrendingProducts(parsed.data.pincode);
    return response.success({ products, count: products.length });
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error', error, requestId, userId });
    return response.internalError();
  }
};

export const getBarcodeHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext);
  const requestId = event.requestContext.requestId;

  const schema = z.object({ code: z.string().min(1) });
  const parsed = schema.safeParse(event.pathParameters ?? {});
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const product = await getProductByBarcode(parsed.data.code);
    return response.success(product);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error', error, requestId, userId });
    return response.internalError();
  }
};
