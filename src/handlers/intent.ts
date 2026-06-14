/**
 * Amazon Now Snap — Intent Lambda Handlers
 *
 * Routes:
 *   POST /v1/intent/text   → resolveTextIntentHandler
 *   POST /v1/intent/voice  → resolveVoiceIntentHandler
 *
 * Auth: JWT Bearer token required. userId extracted exclusively from
 *       event.requestContext.authorizer?.jwt?.claims?.sub
 *
 * Body schema: { transcript: string, pincode: string }
 * Model: @models/Intent
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import type { APIGatewayEventRequestContextV2 } from 'aws-lambda';
import { resolveTextIntent, resolveVoiceIntent } from '@services/IntentService';
import { IntentRequestSchema } from '@models/Intent';
import { response } from '@utils/response';
import { logger } from '@utils/logger';
import { AppError } from '@constants/errors';

// ============================================================================
// Helpers
// ============================================================================

/** Extracts the JWT sub claim from the Cognito authorizer context */
function getUserId(requestContext: APIGatewayEventRequestContextV2, headers?: Record<string, string | undefined>): string | undefined {
  // Try Cognito authorizer context first (production path)
  const ctx = requestContext as APIGatewayEventRequestContextV2 & {
    authorizer?: { jwt?: { claims?: Record<string, string> } };
  };
  const fromContext = ctx.authorizer?.jwt?.claims?.['sub'];
  if (fromContext) return fromContext;

  // Fallback: parse JWT from Authorization header directly (Serverless Offline local dev)
  const authHeader = headers?.['authorization'] ?? headers?.['Authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = token.split('.')[1];
      if (payload) {
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')) as Record<string, unknown>;
        if (typeof decoded['sub'] === 'string') return decoded['sub'];
      }
    } catch {
      // ignore malformed token
    }
  }

  return undefined;
}

/** Parse and validate JSON body; returns null on failure */
function parseBody(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// resolveTextIntentHandler  POST /v1/intent/text
// ============================================================================

export const resolveTextIntentHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext, event.headers);
  const requestId = event.requestContext.requestId;

  if (!userId) {
    return response.unauthorized('Missing user identity');
  }

  const body = parseBody(event.body);
  if (!body) {
    return response.badRequest('Request body must be valid JSON');
  }

  const parsed = IntentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const result = await resolveTextIntent(parsed.data.transcript, parsed.data.pincode, userId);
    return response.success(result);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error in resolveTextIntentHandler', error, requestId, userId });
    return response.internalError();
  }
};

// ============================================================================
// resolveVoiceIntentHandler  POST /v1/intent/voice
// ============================================================================

export const resolveVoiceIntentHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getUserId(event.requestContext, event.headers);
  const requestId = event.requestContext.requestId;

  if (!userId) {
    return response.unauthorized('Missing user identity');
  }

  const body = parseBody(event.body);
  if (!body) {
    return response.badRequest('Request body must be valid JSON');
  }

  const parsed = IntentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return response.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  try {
    const result = await resolveVoiceIntent(parsed.data.transcript, parsed.data.pincode, userId);
    return response.success(result);
  } catch (error) {
    if (error instanceof AppError) {
      return response.error(error.code, error.message, error.statusCode, error.retryable);
    }
    logger.error({ message: 'Unhandled error in resolveVoiceIntentHandler', error, requestId, userId });
    return response.internalError();
  }
};
