/**
 * Amazon Now Snap — SmartCart Lambda Handlers
 *
 * Routes:
 *   GET  /v1/smart-cart?pincode=<6-digit>  → getSmartCartHandler
 *   POST /v1/smart-cart/refresh            → refreshSmartCartHandler
 *
 * Auth: JWT Bearer token required. userId extracted exclusively from
 *       event.requestContext.authorizer?.jwt?.claims?.sub
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import type { APIGatewayEventRequestContextV2 } from 'aws-lambda';
import { z } from 'zod';
import { getSmartCart, refreshSmartCart } from '@services/SmartCartService';
import { response } from '@utils/response';
import { logger } from '@utils/logger';
import { AppError } from '@constants/errors';

// ============================================================================
// Helpers
// ============================================================================

/** Extract the JWT sub claim from the Cognito authorizer context. */
function getUserId(requestContext: APIGatewayEventRequestContextV2, headers?: Record<string, string | undefined>): string | undefined {
  const ctx = requestContext as APIGatewayEventRequestContextV2 & {
    authorizer?: { jwt?: { claims?: Record<string, string> } };
  };
  const fromContext = ctx.authorizer?.jwt?.claims?.['sub'];
  if (fromContext) return fromContext;

  const authHeader = headers?.['authorization'] ?? headers?.['Authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = authHeader.slice(7).split('.')[1];
      if (payload) {
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')) as Record<string, unknown>;
        if (typeof decoded['sub'] === 'string') return decoded['sub'];
      }
    } catch { /* ignore */ }
  }
  return undefined;
}

const pincodeSchema = z.string().regex(/^\d{6}$/, 'pincode must be a 6-digit number');

// ============================================================================
// getSmartCartHandler — GET /v1/smart-cart?pincode=110001
// ============================================================================

export const getSmartCartHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event.requestContext, event.headers);

  if (!userId) {
    return response.unauthorized('Missing or invalid authorization token');
  }

  const parsed = z
    .object({ pincode: pincodeSchema })
    .safeParse(event.queryStringParameters ?? {});

  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const result = await getSmartCart(userId, parsed.data.pincode);
    return response.success(result);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error in getSmartCartHandler', error, requestId, userId });
    return response.internalError();
  }
};

// ============================================================================
// refreshSmartCartHandler — POST /v1/smart-cart/refresh
// ============================================================================

export const refreshSmartCartHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event.requestContext, event.headers);

  if (!userId) {
    return response.unauthorized('Missing or invalid authorization token');
  }

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return response.badRequest('Invalid JSON body');
  }

  const parsed = z.object({ pincode: pincodeSchema }).safeParse(body);
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const result = await refreshSmartCart(userId, parsed.data.pincode);
    return response.success(result);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({
      message: 'Unhandled error in refreshSmartCartHandler',
      error,
      requestId,
      userId,
    });
    return response.internalError();
  }
};
