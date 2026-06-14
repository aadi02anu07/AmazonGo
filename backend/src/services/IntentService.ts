/**
 * Amazon Now Snap — Intent Service
 *
 * Business-logic layer for intent resolution (text and voice).
 * Delegates to the injected IntentResolutionAdapter via the factory.
 *
 * Routes served:
 *   POST /v1/intent/text
 *   POST /v1/intent/voice
 *
 * Confidence tier logic (≥0.75, 0.50–0.74, <0.50) is handled inside the
 * adapter (KeywordIntentAdapter / BedrockIntentAdapter). This service only
 * validates inputs and translates adapter errors to AppErrors.
 */

import { intentAdapter } from '@adapters/factory';
import { logger } from '@utils/logger';
import { AppError, ErrorCodes } from '@constants/errors';
import { IntentResult } from '@models/Intent';

// ============================================================================
// resolveTextIntent
// ============================================================================

/**
 * Resolve intent from a text transcript.
 *
 * Throws AppError EMPTY_TRANSCRIPT (400) when transcript is empty after trim.
 * Throws AppError INTENT_RESOLUTION_FAILED (500) when the adapter fails.
 */
export async function resolveTextIntent(
  transcript: string,
  pincode: string,
  userId: string
): Promise<IntentResult> {
  const trimmed = transcript.trim();

  if (trimmed.length === 0) {
    throw new AppError(ErrorCodes.EMPTY_TRANSCRIPT, 'Transcript must not be empty', 400);
  }

  try {
    const result = await intentAdapter.resolveIntent(trimmed, pincode, userId);

    logger.info({
      message: 'Text intent resolved',
      userId,
      pincode,
      confidence: result.confidence,
      resolvedBy: result.resolvedBy,
    });

    return result;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error({
      message: 'Text intent resolution failed',
      userId,
      pincode,
      error,
    });

    throw new AppError(
      ErrorCodes.INTENT_RESOLUTION_FAILED,
      'Failed to resolve text intent',
      500,
      true
    );
  }
}

// ============================================================================
// resolveVoiceIntent
// ============================================================================

/**
 * Resolve intent from a voice transcript.
 * In hackathon mode voice is already transcribed text — same logic as text.
 *
 * Throws AppError EMPTY_TRANSCRIPT (400) when transcript is empty after trim.
 * Throws AppError INTENT_RESOLUTION_FAILED (500) when the adapter fails.
 */
export async function resolveVoiceIntent(
  transcript: string,
  pincode: string,
  userId: string
): Promise<IntentResult> {
  const trimmed = transcript.trim();

  if (trimmed.length === 0) {
    throw new AppError(ErrorCodes.EMPTY_TRANSCRIPT, 'Transcript must not be empty', 400);
  }

  try {
    const result = await intentAdapter.resolveIntent(trimmed, pincode, userId);

    logger.info({
      message: 'Voice intent resolved',
      userId,
      pincode,
      confidence: result.confidence,
      resolvedBy: result.resolvedBy,
    });

    return result;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error({
      message: 'Voice intent resolution failed',
      userId,
      pincode,
      error,
    });

    throw new AppError(
      ErrorCodes.INTENT_RESOLUTION_FAILED,
      'Failed to resolve voice intent',
      500,
      true
    );
  }
}
