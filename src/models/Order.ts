/**
 * Amazon Now Snap — Order Data Models
 *
 * All monetary fields (subtotal, deliveryFee, total, priceAtOrder) store
 * whole-integer paise values. 1 INR = 100 paise. No decimal component permitted.
 *
 * orderId format: ord_{timestamp}_{uuid6}  e.g. ord_1704067200000_abc123
 *
 * Handlers: POST /v1/orders, GET /v1/orders, GET /v1/orders/recent,
 *           GET /v1/orders/{orderId}, POST /v1/orders/{orderId}/reorder
 * Auth: JWT Bearer token required
 */

import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PICKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  productId: string;
  name: string;
  brand: string;
  quantity: number;
  /** Whole-integer paise value. 1 INR = 100 paise. No decimal component. */
  priceAtOrder: number;
  imageUrl: string;
}

export interface Order {
  /** Format: ord_{timestamp}_{uuid6}  e.g. ord_1704067200000_abc123 */
  orderId: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  /** Whole-integer paise value. 1 INR = 100 paise. */
  subtotal: number;
  /** Whole-integer paise value. Always 0 for hackathon. */
  deliveryFee: number;
  /** Whole-integer paise value. subtotal + deliveryFee. */
  total: number;
  pincode: string;
  addressId: string;
  darkStoreId: string;
  etaMinutes: number;
  /** ISO 8601 UTC timestamp */
  etaAt: string;
  paymentMethod: string;
  paymentStatus: string;
  /** ISO 8601 UTC timestamp */
  createdAt: string;
  /** ISO 8601 UTC timestamp */
  updatedAt: string;
}

export interface OrderRequest {
  items: Array<{ productId: string; quantity: number }>;
  pincode: string;
  addressId: string;
  paymentMethod?: string;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const OrderRequestSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'productId is required'),
        quantity: z
          .number()
          .int('quantity must be an integer')
          .min(1, 'quantity must be at least 1')
          .max(99, 'quantity must be at most 99'),
      })
    )
    .min(1, 'items must not be empty'),
  pincode: z.string().regex(/^\d{6}$/, 'pincode must be exactly 6 digits'),
  addressId: z.string().min(1, 'addressId is required'),
  paymentMethod: z.string().min(1).optional(),
});
