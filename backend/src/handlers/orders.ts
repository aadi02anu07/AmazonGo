/**
 * Amazon Now Snap — Orders Lambda Handlers
 *
 * Routes:
 *   POST /v1/orders                          - placeOrderHandler   (201)
 *   GET  /v1/orders                          - getOrderHistoryHandler
 *   GET  /v1/orders/recent                   - getRecentOrdersHandler
 *   GET  /v1/orders/{orderId}                - getOrderHandler
 *   POST /v1/orders/{orderId}/reorder        - reorderHandler      (201)
 *
 * Auth: JWT Bearer token required. userId extracted exclusively from
 *       event.requestContext.authorizer?.jwt?.claims?.sub
 *
 * Model: @models/Order
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import type { APIGatewayEventRequestContextV2 } from 'aws-lambda';
import { z } from 'zod';
import {
  placeOrder,
  getOrder,
  getOrderHistory,
  getRecentOrders,
  reorder,
} from '@services/OrdersService';
import { OrderRequestSchema } from '@models/Order';
import { response } from '@utils/response';
import { logger } from '@utils/logger';
import { AppError } from '@constants/errors';

// ============================================================================
// Auth helper
// ============================================================================

/** Extract JWT sub claim from the Cognito authorizer context */
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

// ============================================================================
// POST /v1/orders
// ============================================================================

export const placeOrderHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext, event.headers);
  const requestId = event.requestContext.requestId;

  if (!userId) {
    return response.unauthorized('Missing or invalid authorization token');
  }

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return response.badRequest('Request body must be valid JSON');
  }

  const parsed = OrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const order = await placeOrder(userId, parsed.data);
    return response.success(order, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error in placeOrderHandler', error, requestId, userId });
    return response.internalError();
  }
};

// ============================================================================
// GET /v1/orders
// ============================================================================

export const getOrderHistoryHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext, event.headers);
  const requestId = event.requestContext.requestId;

  if (!userId) {
    return response.unauthorized('Missing or invalid authorization token');
  }

  const schema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  });

  const parsed = schema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const result = await getOrderHistory(userId, parsed.data.limit, parsed.data.cursor);
    return response.success(result);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error in getOrderHistoryHandler', error, requestId, userId });
    return response.internalError();
  }
};

// ============================================================================
// GET /v1/orders/recent
// ============================================================================

export const getRecentOrdersHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext, event.headers);
  const requestId = event.requestContext.requestId;

  if (!userId) {
    return response.unauthorized('Missing or invalid authorization token');
  }

  try {
    const orders = await getRecentOrders(userId);
    return response.success({ orders, count: orders.length });
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error in getRecentOrdersHandler', error, requestId, userId });
    return response.internalError();
  }
};

// ============================================================================
// GET /v1/orders/{orderId}
// ============================================================================

export const getOrderHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext, event.headers);
  const requestId = event.requestContext.requestId;

  if (!userId) {
    return response.unauthorized('Missing or invalid authorization token');
  }

  const schema = z.object({ orderId: z.string().min(1) });
  const parsed = schema.safeParse(event.pathParameters ?? {});
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const order = await getOrder(parsed.data.orderId, userId);
    return response.success(order);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error in getOrderHandler', error, requestId, userId });
    return response.internalError();
  }
};

// ============================================================================
// POST /v1/orders/{orderId}/reorder
// ============================================================================

export const reorderHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext, event.headers);
  const requestId = event.requestContext.requestId;

  if (!userId) {
    return response.unauthorized('Missing or invalid authorization token');
  }

  const schema = z.object({ orderId: z.string().min(1) });
  const parsed = schema.safeParse(event.pathParameters ?? {});
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const newOrder = await reorder(parsed.data.orderId, userId);
    return response.success(newOrder, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error in reorderHandler', error, requestId, userId });
    return response.internalError();
  }
};
