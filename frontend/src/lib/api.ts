import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  timeout: 10000,
});

// ── Auth interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('snap_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

// ── Helper: convert paise → rupees ────────────────────────────────────────
const paiseToRupees = (paise: number) => paise / 100;

// ── Helper: normalize a product from backend shape to frontend shape ───────
export function normalizeProduct(p: Record<string, unknown>) {
  return {
    id: p.productId as string,
    name: p.name as string,
    brand: p.brand as string,
    category: p.category as string,
    subCategory: p.subCategory as string,
    price: paiseToRupees(p.price as number),
    mrp: paiseToRupees(p.mrp as number),
    unit: p.unit as string,
    image: ((p.imageUrls as string[]) ?? [])[0] ?? '',
    imageUrls: (p.imageUrls as string[]) ?? [],
    tags: (p.tags as string[]) ?? [],
    isAvailable: (p.isAvailable as boolean) ?? true,
    barcodes: (p.barcodes as string[]) ?? [],
    weight: p.weight as string,
    description: p.description as string,
    score: (p.score as number) ?? 0,
  };
}

// ── Helper: normalize an order from backend shape to frontend shape ─────────
export function normalizeOrder(o: Record<string, unknown>) {
  const items = ((o.items as Record<string, unknown>[]) ?? []).map((item) => ({
    ...item,
    id: item.productId,
    price: paiseToRupees(item.priceAtOrder as number),
    image: (item.imageUrl as string) ?? '',
  }));
  return {
    ...o,
    id: o.orderId as string,
    total: paiseToRupees(o.total as number),
    subtotal: paiseToRupees(o.subtotal as number),
    date: o.createdAt as string,
    items,
  };
}

// ── Helper: normalize a recommendation from backend shape ──────────────────
export function normalizeRecommendation(r: Record<string, unknown>) {
  return {
    id: r.productId as string,
    name: r.name as string,
    brand: r.brand as string,
    price: paiseToRupees(r.price as number),
    mrp: paiseToRupees(r.price as number), // recommendations don't have mrp, use price
    image: (r.imageUrl as string) ?? '',
    isAvailable: true,
    confidence: r.confidence as number,
    reason: r.reason as string,
  };
}

// ── apiClient: wraps real API calls, normalizes responses ──────────────────
export const apiClient = {
  get: async (url: string, config?: Record<string, unknown>) => {
    const res = await api.get(url, config);
    const body = res.data; // { success, data, error, requestId, timestamp }

    // Normalize specific endpoints
    if (url.includes('/v1/products/trending')) {
      const products = (body.data?.products ?? body.data ?? []) as Record<string, unknown>[];
      return { data: { success: true, data: products.map(normalizeProduct) } };
    }

    if (url.includes('/v1/products/search')) {
      const results = (body.data?.results ?? body.data ?? []) as Record<string, unknown>[];
      return { data: { success: true, data: results.map(normalizeProduct) } };
    }

    if (url.match(/\/v1\/products\/[^/]+$/) && !url.includes('search') && !url.includes('trending') && !url.includes('barcode')) {
      const product = body.data as Record<string, unknown>;
      return { data: { success: true, data: normalizeProduct(product) } };
    }

    if (url.includes('/v1/products/barcode/')) {
      const product = body.data as Record<string, unknown>;
      return { data: { success: true, data: normalizeProduct(product) } };
    }

    if (url.includes('/v1/smart-cart')) {
      const raw = body.data as Record<string, unknown>;
      return {
        data: {
          success: true,
          data: {
            tier: raw.tier,
            label: raw.label,
            explanation: raw.label, // frontend uses "explanation", backend sends "label"
            products: ((raw.suggestions ?? []) as Record<string, unknown>[]).map(normalizeRecommendation),
            generatedAt: raw.generatedAt,
          },
        },
      };
    }

    if (url.includes('/v1/orders') && !url.includes('reorder') && !url.includes('/v1/orders/')) {
      const raw = body.data as Record<string, unknown>;
      const orders = ((raw.orders ?? raw ?? []) as Record<string, unknown>[]).map(normalizeOrder);
      return { data: { success: true, data: orders } };
    }

    if (url.match(/\/v1\/orders\/[^/]+$/) && !url.includes('reorder')) {
      const order = body.data as Record<string, unknown>;
      return { data: { success: true, data: normalizeOrder(order) } };
    }

    if (url.includes('/v1/inventory')) {
      return { data: body };
    }

    if (url.includes('/v1/eta')) {
      return { data: body };
    }

    return { data: body };
  },

  post: async (url: string, data?: unknown, config?: Record<string, unknown>) => {
    const res = await api.post(url, data, config);
    const body = res.data;

    if (url === '/v1/orders') {
      const order = body.data as Record<string, unknown>;
      return { data: { success: true, data: normalizeOrder(order) } };
    }

    if (url.includes('/reorder')) {
      const order = body.data as Record<string, unknown>;
      return { data: { success: true, data: normalizeOrder(order) } };
    }

    if (url.includes('/v1/smart-cart/refresh')) {
      const raw = body.data as Record<string, unknown>;
      return {
        data: {
          success: true,
          data: {
            tier: raw.tier,
            label: raw.label,
            explanation: raw.label,
            products: ((raw.suggestions ?? []) as Record<string, unknown>[]).map(normalizeRecommendation),
          },
        },
      };
    }

    if (url.includes('/v1/intent')) {
      // Intent returns { productId, confidence, resolvedBy, alternatives, suggestedInput, ... }
      const result = body.data as Record<string, unknown>;
      return {
        data: {
          success: true,
          data: {
            confidence: result.confidence,
            productId: result.productId,
            alternatives: ((result.alternatives ?? []) as Record<string, unknown>[]).map((a) => a.productId),
            suggestion: result.suggestedInput,
            resolvedBy: result.resolvedBy,
          },
        },
      };
    }

    return { data: body };
  },
};
