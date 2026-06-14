/**
 * Amazon Now Snap — ETA Lambda Handlers
 *
 * Routes:
 *   GET  /v1/eta?pincode=110001   → calculateETAHandler
 *   POST /v1/eta/batch            → batchETAHandler
 *
 * Auth: JWT Bearer token required.
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { calculateETA, batchCalculateETA } from '@services/ETAService';
import { ETARequestSchema, BatchETARequestSchema } from '@models/ETA';
import { response } from '@utils/response';
import { logger } from '@utils/logger';
import { AppError } from '@constants/errors';

// ============================================================================
// calculateETAHandler  —  GET /v1/eta?pincode=110001
// ============================================================================

export const calculateETAHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId;

  const parsed = ETARequestSchema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid pincode');
  }

  try {
    const etaResult = await calculateETA(parsed.data.pincode);
    return response.success(etaResult, 200, requestId);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable, requestId);
    }
    logger.error({ message: 'Unhandled error in calculateETAHandler', error, requestId });
    return response.internalError(undefined, requestId);
  }
};

// ============================================================================
// batchETAHandler  —  POST /v1/eta/batch
// ============================================================================

export const batchETAHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId;

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return response.badRequest('Invalid JSON body', requestId);
  }

  const parsed = BatchETARequestSchema.safeParse(body);
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid request body', requestId);
  }

  try {
    const results = await batchCalculateETA(parsed.data.pincodes);
    return response.success({ results, count: results.length }, 200, requestId);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable, requestId);
    }
    logger.error({ message: 'Unhandled error in batchETAHandler', error, requestId });
    return response.internalError(undefined, requestId);
  }
};
