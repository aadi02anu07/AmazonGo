/**
 * Amazon Now Snap — Intent Models
 *
 * Re-exports and extends the adapter-level IntentResult for the service layer.
 * The confidence tier logic lives in the adapters; the service and handlers
 * work with these types exclusively.
 */

import type { IntentResult as AdapterIntentResult } from '@adapters/interfaces';
import { z } from 'zod';

// Re-export the adapter's IntentResult for service-layer use
export type IntentResult = AdapterIntentResult;

export interface IntentRequest {
  transcript: string;
  pincode: string;
  userId: string;
}

export const IntentRequestSchema = z.object({
  transcript: z
    .string()
    .min(1, 'Transcript is required')
    .max(1000, 'Transcript too long')
    .trim(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
});
