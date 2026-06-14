import { Product } from '../../src/models/Product';

export function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    productId: 'prod_test_001',
    sku: 'SKU-TEST-001',
    name: 'Test Product',
    brand: 'Test Brand',
    category: 'grocery',
    subCategory: 'dairy',
    description: 'Test product description',
    imageUrls: ['https://cdn.snap.dev/test.jpg'],
    price: 5000,
    mrp: 6000,
    unit: '500ml',
    tags: ['test', 'product'],
    weight: '500g',
    barcodes: ['1234567890123'],
    rekognitionLabels: ['Food'],
    isAvailable: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function buildInventoryRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pincodeProductId: '110001#prod_test_001',
    pincode: '110001',
    productId: 'prod_test_001',
    darkStoreId: 'ds_lajpat_nagar',
    stockLevel: 50,
    isAvailableFor10Min: true,
    reservedUnits: 0,
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function buildUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: 'test_user_001',
    email: 'test@snap.dev',
    totalOrders: 0,
    smartCartTier: 'trending',
    defaultPincode: '110001',
    notificationsEnabled: true,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function buildOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    orderId: 'ord_1704067200000_abc123',
    userId: 'test_user_001',
    status: 'PLACED',
    items: [
      {
        productId: 'prod_test_001',
        name: 'Test Product',
        brand: 'Test Brand',
        quantity: 1,
        priceAtOrder: 5000,
        imageUrl: 'https://cdn.snap.dev/test.jpg',
      },
    ],
    subtotal: 5000,
    deliveryFee: 0,
    total: 5000,
    pincode: '110001',
    addressId: 'addr_001',
    darkStoreId: 'ds_lajpat_nagar',
    etaMinutes: 12,
    etaAt: '2024-01-01T00:15:00.000Z',
    paymentMethod: 'amazon_pay',
    paymentStatus: 'COMPLETED',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function buildDarkStore(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    darkStoreId: 'ds_lajpat_nagar',
    name: 'Lajpat Nagar',
    city: 'Delhi',
    lat: 28.5677,
    lng: 77.2433,
    serviceablePincodes: ['110001', '110024', '110003'],
    avgPickupMinutes: 4,
    isOperational: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}
