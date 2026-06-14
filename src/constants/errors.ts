/**
 * Amazon Now Snap — Error Constants
 * 
 * Centralized error codes and custom error classes.
 * All errors thrown in the application should use these codes.
 */

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCodes = {
  // Validation Errors (400)
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  INVALID_PINCODE: 'INVALID_PINCODE',
  INVALID_PRODUCT_ID: 'INVALID_PRODUCT_ID',

  // Authentication/Authorization Errors (401, 403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Resource Not Found (404)
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ADDRESS_NOT_FOUND: 'ADDRESS_NOT_FOUND',
  BARCODE_NOT_FOUND: 'BARCODE_NOT_FOUND',
  DARK_STORE_NOT_FOUND: 'DARK_STORE_NOT_FOUND',

  // Business Logic Errors (422)
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
  DARK_STORE_UNAVAILABLE: 'DARK_STORE_UNAVAILABLE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  ORDER_ALREADY_PLACED: 'ORDER_ALREADY_PLACED',
  INSUFFICIENT_INVENTORY: 'INSUFFICIENT_INVENTORY',
  EMPTY_CART: 'EMPTY_CART',
  EMPTY_TRANSCRIPT: 'EMPTY_TRANSCRIPT',
  RESERVATION_FAILED: 'RESERVATION_FAILED',
  DUPLICATE_ORDER: 'DUPLICATE_ORDER',
  PINCODE_NOT_SERVICEABLE: 'PINCODE_NOT_SERVICEABLE',
  DARKSTORE_OFFLINE: 'DARKSTORE_OFFLINE',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  NO_PRODUCTS_AVAILABLE: 'NO_PRODUCTS_AVAILABLE',

  // Calculation / Service Failures
  ETA_CALCULATION_FAILED: 'ETA_CALCULATION_FAILED',
  STOCK_CHECK_FAILED: 'STOCK_CHECK_FAILED',
  RECOMMENDATION_FAILED: 'RECOMMENDATION_FAILED',

  // AI/Intent Resolution Errors
  INTENT_RESOLUTION_FAILED: 'INTENT_RESOLUTION_FAILED',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  PHOTO_ANALYSIS_FAILED: 'PHOTO_ANALYSIS_FAILED',
  VOICE_TRANSCRIPTION_FAILED: 'VOICE_TRANSCRIPTION_FAILED',
  BEDROCK_TIMEOUT: 'BEDROCK_TIMEOUT',
  REKOGNITION_FAILED: 'REKOGNITION_FAILED',

  // System Errors (500, 503)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Rate Limiting (429)
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

export function createValidationError(message: string): AppError {
  return new AppError(ErrorCodes.INVALID_INPUT, message, 400);
}

export function createNotFoundError(resource: string): AppError {
  return new AppError(
    `${resource.toUpperCase()}_NOT_FOUND` as any,
    `${resource} not found`,
    404
  );
}

export function createOutOfStockError(productId: string): AppError {
  return new AppError(
    ErrorCodes.OUT_OF_STOCK,
    `Product ${productId} is out of stock`,
    422
  );
}

export function createInternalError(message: string = 'Internal server error'): AppError {
  return new AppError(ErrorCodes.INTERNAL_ERROR, message, 500, true);
}
