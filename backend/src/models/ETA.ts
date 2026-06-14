/**
 * Amazon Now Snap — ETA Data Models
 *
 * Models for ETA calculation responses and DarkStore entities.
 *
 * Handlers: GET /v1/eta?pincode=110001
 *           POST /v1/eta/batch
 * Auth: JWT Bearer token required
 */

import { z } from 'zod';

// ============================================================================
// Interfaces
// ============================================================================

export interface ETAResult {
  etaMinutes: number;
  /** ISO 8601 UTC timestamp — now + etaMinutes */
  etaAt: string;
  darkStoreId: string;
  /** Human-readable label e.g. "Delivery in 12 minutes" */
  label: string;
}

export interface DarkStore {
  darkStoreId: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  serviceablePincodes: string[];
  avgPickupMinutes: number;
  isOperational: boolean;
  updatedAt: string;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const ETARequestSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
});

export const BatchETARequestSchema = z.object({
  pincodes: z
    .array(z.string().regex(/^\d{6}$/, 'Each pincode must be exactly 6 digits'))
    .min(1, 'At least one pincode is required')
    .max(50, 'Maximum 50 pincodes per batch request'),
});
