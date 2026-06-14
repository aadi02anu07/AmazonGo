/**
 * Amazon Now Snap — Inventory Models
 *
 * TypeScript interfaces and Zod validation schemas for inventory operations.
 *
 * DynamoDB key pattern:
 *   InventoryRecord PK: pincodeProductId = "{pincode}#{productId}"
 *   ReservationRecord PK: pincodeProductId = "{pincode}#{productId}", SK: userId
 */

import { z } from 'zod';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface InventoryRecord {
  /** Composite key: "{pincode}#{productId}" */
  pincodeProductId: string;
  pincode: string;
  productId: string;
  darkStoreId: string;
  stockLevel: number;
  isAvailableFor10Min: boolean;
  reservedUnits: number;
  /** ISO 8601 UTC — populated when reservedUnits > 0 */
  reservationExpiresAt?: string;
  updatedAt: string;
}

export interface InventoryStatus {
  productId: string;
  pincode: string;
  isAvailableFor10Min: boolean;
  stockLevel: number;
  darkStoreId: string;
}

export interface ReservationRecord {
  /** Composite key: "{pincode}#{productId}" */
  pincodeProductId: string;
  pincode: string;
  productId: string;
  userId: string;
  quantity: number;
  /** ISO 8601 UTC */
  reservedAt: string;
  /** ISO 8601 UTC — reservedAt + 90 seconds */
  expiresAt: string;
  /** Unix epoch seconds for DynamoDB TTL auto-deletion */
  ttl: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

/** Validate path parameters for a single inventory check */
export const InventoryCheckSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  productId: z.string().min(1, 'productId is required'),
});

/** Validate request body for a batch inventory check */
export const BatchCheckSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  productIds: z
    .array(z.string().min(1))
    .min(1, 'At least one productId is required')
    .max(25, 'Maximum 25 products per batch'),
});

/** Validate a reservation quantity — must be an integer between 1 and 99 */
export const QuantitySchema = z
  .number()
  .int('Quantity must be an integer')
  .min(1, 'Quantity must be at least 1')
  .max(99, 'Quantity cannot exceed 99');
