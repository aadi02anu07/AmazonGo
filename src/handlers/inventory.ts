/**
 * Amazon Now Snap — Inventory Lambda Handlers
 *
 * Routes:
 *   GET  /v1/inventory/{pincode}/{productId}  — checkStockHandler
 *   POST /v1/inventory/batch-check             — batchCheckHandler
 *
 * Auth: JWT Bearer token required. userId extracted exclusively from
 *       event.requestContext.authorizer?.jwt?.claims?.sub
 *
 * Model: @models/Inventory
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import type { APIGatewayEventRequestContextV2 } from 'aws-lambda';
import { checkStock, batchCheckStock } from '@services/InventoryService';
import { response } from '@utils/response';
import { logger } from '@utils/logger';
import { AppError } from '@constants/errors';
import { InventoryCheckSchema, BatchCheckSchema } from '@models/Inventory';

// ============================================================================
// Auth helper
// ============================================================================

/** Extracts the JWT sub claim from the Cognito authorizer context */
function getUserId(requestContext: APIGatewayEventRequestContextV2): string | undefined {
  const ctx = requestContext as APIGatewayEventRequestContextV2 & {
    authorizer?: { jwt?: { claims?: Record<string, string> } };
  };
  return ctx.authorizer?.jwt?.claims?.['sub'];
}

// ============================================================================
// Error handler helper
// ============================================================================

function handleError(
  error: unknown,
  requestId: string,
  userId: string | undefined,
  context: string
) {
  if (error instanceof AppError) {
    return response.error(error.code, error.message, error.statusCode, error.retryable);
  }
  logger.error({ message: `Unhandled error in ${context}`, error, requestId, userId });
  return response.internalError();
}

// ============================================================================
// GET /v1/inventory/{pincode}/{productId}
// ============================================================================

export const checkStockHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext);
  const requestId = event.requestContext.requestId;

  const parsed = InventoryCheckSchema.safeParse(event.pathParameters ?? {});
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const status = await checkStock(parsed.data.pincode, parsed.data.productId);
    return response.success(status);
  } catch (error) {
    return handleError(error, requestId, userId, 'checkStockHandler');
  }
};

// ============================================================================
// POST /v1/inventory/batch-check
// ============================================================================

export const batchCheckHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext);
  const requestId = event.requestContext.requestId;

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return response.badRequest('Request body must be valid JSON');
  }

  const parsed = BatchCheckSchema.safeParse(body);
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const results = await batchCheckStock(parsed.data.pincode, parsed.data.productIds);
    return response.success({ results, count: results.length });
  } catch (error) {
    return handleError(error, requestId, userId, 'batchCheckHandler');
  }
};
