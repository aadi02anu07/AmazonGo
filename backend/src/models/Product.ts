/**
 * Amazon Now Snap — Product Data Models
 * 
 * All monetary fields (price, mrp) store whole-integer paise values.
 * 1 INR = 100 paise. No decimal component is permitted.
 * 
 * Handlers: GET /v1/products/{productId}, GET /v1/products/search,
 *           GET /v1/products/trending, GET /v1/products/barcode/{code}
 * Auth: JWT Bearer token required
 * Model: Product interface below
 */

export interface Product {
  productId: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  description: string;
  imageUrls: string[];
  /** Whole-integer paise value. 1 INR = 100 paise. No decimal component. */
  price: number;
  /** Whole-integer paise value. 1 INR = 100 paise. No decimal component. */
  mrp: number;
  unit: string;
  tags: string[];
  weight: string;
  barcodes: string[];
  rekognitionLabels: string[];
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSummary {
  productId: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  /** Whole-integer paise value. 1 INR = 100 paise. No decimal component. */
  price: number;
  /** Whole-integer paise value. 1 INR = 100 paise. No decimal component. */
  mrp: number;
  unit: string;
  imageUrls: string[];
  tags: string[];
  isAvailable: boolean;
}

export interface InventoryStatus {
  productId: string;
  pincode: string;
  isAvailableFor10Min: boolean;
  stockLevel: number;
  darkStoreId: string;
  /** ISO 8601 UTC timestamp */
  cachedAt: string;
}

export interface SearchResult extends ProductSummary {
  /**
   * Non-negative relevance score.
   * Integer token-match count in hackathon mode; float confidence in production mode.
   */
  score: number;
}

export interface BarcodeResult {
  productId: string;
  barcode: string;
  product: Product;
}

import { z } from 'zod';

// Zod validation schemas
export const PincodeSchema = z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits');
export const ProductIdSchema = z.string().min(1, 'Product ID is required');
export const SearchQuerySchema = z.string().min(1, 'Search query is required').max(200, 'Search query must be at most 200 characters');
export const BarcodeSchema = z.string().min(1, 'Barcode is required');
export const QuantitySchema = z.number().int().min(1, 'Quantity must be at least 1').max(99, 'Quantity must be at most 99');
export const LimitSchema = z.coerce.number().int().min(1).max(50).optional();
