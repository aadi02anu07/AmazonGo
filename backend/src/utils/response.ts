/**
 * Amazon Now Snap — Standard API Response Formatter
 * 
 * All Lambda handlers must use this response formatter to ensure
 * consistent API response structure across all endpoints.
 * 
 * Usage:
 *   import { response } from '@utils/response';
 *   return response.success({ data: result });
 *   return response.error('PRODUCT_NOT_FOUND', 'Product not found', 404);
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda';

interface SuccessResponseData<T = unknown> {
  success: true;
  data: T;
  error: null;
  requestId: string;
  timestamp: string;
}

interface ErrorResponseData {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  requestId: string;
  timestamp: string;
}

class ResponseFormatter {
  /**
   * Generate request ID (simplified for now, can be replaced with UUID)
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Success response (200 or 201)
   */
  public success<T>(data: T, statusCode: number = 200, requestId?: string): APIGatewayProxyResultV2 {
    const responseBody: SuccessResponseData<T> = {
      success: true,
      data,
      error: null,
      requestId: requestId || this.generateRequestId(),
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': responseBody.requestId,
      },
      body: JSON.stringify(responseBody),
    };
  }

  /**
   * Error response (4xx or 5xx)
   */
  public error(
    code: string,
    message: string,
    statusCode: number = 500,
    retryable: boolean = false,
    requestId?: string
  ): APIGatewayProxyResultV2 {
    const responseBody: ErrorResponseData = {
      success: false,
      data: null,
      error: {
        code,
        message,
        retryable,
      },
      requestId: requestId || this.generateRequestId(),
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': responseBody.requestId,
      },
      body: JSON.stringify(responseBody),
    };
  }

  /**
   * Common error responses
   */
  public badRequest(message: string, requestId?: string): APIGatewayProxyResultV2 {
    return this.error('BAD_REQUEST', message, 400, false, requestId);
  }

  public unauthorized(message: string = 'Unauthorized', requestId?: string): APIGatewayProxyResultV2 {
    return this.error('UNAUTHORIZED', message, 401, false, requestId);
  }

  public forbidden(message: string = 'Forbidden', requestId?: string): APIGatewayProxyResultV2 {
    return this.error('FORBIDDEN', message, 403, false, requestId);
  }

  public notFound(resource: string, requestId?: string): APIGatewayProxyResultV2 {
    return this.error('NOT_FOUND', `${resource} not found`, 404, false, requestId);
  }

  public conflict(message: string, requestId?: string): APIGatewayProxyResultV2 {
    return this.error('CONFLICT', message, 409, false, requestId);
  }

  public businessRuleViolation(message: string, requestId?: string): APIGatewayProxyResultV2 {
    return this.error('BUSINESS_RULE_VIOLATION', message, 422, false, requestId);
  }

  public tooManyRequests(message: string = 'Rate limit exceeded', requestId?: string): APIGatewayProxyResultV2 {
    return this.error('TOO_MANY_REQUESTS', message, 429, true, requestId);
  }

  public internalError(message: string = 'Internal server error', requestId?: string): APIGatewayProxyResultV2 {
    return this.error('INTERNAL_ERROR', message, 500, true, requestId);
  }

  public serviceUnavailable(message: string = 'Service temporarily unavailable', requestId?: string): APIGatewayProxyResultV2 {
    return this.error('SERVICE_UNAVAILABLE', message, 503, true, requestId);
  }
}

export const response = new ResponseFormatter();
