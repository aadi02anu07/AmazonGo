// Mock Data
export const mockProducts = [
  { id: 'p1', name: 'Amul Taaza Toned Milk', price: 2800, mrp: 3000, category: 'grocery', subCategory: 'dairy', image: 'https://via.placeholder.com/150/F0E6C8/6B4E1A?text=Milk', isAvailable: true, tags: ['dairy', 'milk', 'fresh'] },
  { id: 'p2', name: 'Britannia NutriChoice', price: 4500, mrp: 5000, category: 'snacks', subCategory: 'biscuits', image: 'https://via.placeholder.com/150/F0E6C8/6B4E1A?text=Biscuits', isAvailable: true, tags: ['snacks', 'biscuits', 'healthy'] },
  { id: 'p3', name: 'Tata Salt', price: 2200, mrp: 2400, category: 'grocery', subCategory: 'staples', image: 'https://via.placeholder.com/150/F0E6C8/6B4E1A?text=Salt', isAvailable: true, tags: ['staples', 'salt', 'grocery'] },
  { id: 'p4', name: 'Dolo 650', price: 3000, mrp: 3000, category: 'medicine', subCategory: 'otc', image: 'https://via.placeholder.com/150/F0E6C8/6B4E1A?text=Dolo+650', isAvailable: true, tags: ['medicine', 'fever', 'otc'] },
  { id: 'p5', name: 'Pampers Diapers', price: 39900, mrp: 49900, category: 'personal-care', subCategory: 'baby', image: 'https://via.placeholder.com/150/F0E6C8/6B4E1A?text=Pampers', isAvailable: false, tags: ['baby', 'diapers', 'care'] },
  { id: 'p6', name: 'Vim Dishwash Liquid', price: 10500, mrp: 11000, category: 'household', subCategory: 'cleaning', image: 'https://via.placeholder.com/150/F0E6C8/6B4E1A?text=Vim', isAvailable: true, tags: ['household', 'cleaning', 'dishwash'] },
  { id: 'p7', name: 'Coca Cola Can', price: 4000, mrp: 4000, category: 'snacks', subCategory: 'beverages', image: 'https://via.placeholder.com/150/F0E6C8/6B4E1A?text=Coca+Cola', isAvailable: true, tags: ['beverages', 'drink', 'cold'] },
  { id: 'p8', name: 'Onion 1kg', price: 3500, mrp: 4000, category: 'grocery', subCategory: 'vegetables', image: 'https://via.placeholder.com/150/F0E6C8/6B4E1A?text=Onion', isAvailable: true, tags: ['vegetables', 'fresh', 'onion'] },
];

let mockOrders: any[] = [];

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const buildResponse = (data: any) => ({
  data: {
    success: true,
    data,
    requestId: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
  }
});

export const mockGet = async (url: string, config?: any) => {
  await delay(500);

  // ETA
  if (url.startsWith('/v1/eta')) {
    return buildResponse({ etaMinutes: 10 });
  }

  // Trending Products
  if (url.startsWith('/v1/products/trending')) {
    return buildResponse(mockProducts.slice(0, 4));
  }

  // Smart Cart
  if (url.startsWith('/v1/smart-cart')) {
    return buildResponse({
      tier: 'Popular Near You',
      explanation: 'Based on orders in your area',
      products: mockProducts.slice(4, 8)
    });
  }

  // Product Search
  if (url.startsWith('/v1/products/search')) {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const q = urlParams.get('q')?.toLowerCase() || '';
    const category = urlParams.get('category');
    
    let filtered = mockProducts;
    if (q) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.tags.includes(q));
    }
    if (category) {
      filtered = filtered.filter(p => p.category === category);
    }
    return buildResponse(filtered);
  }

  // Product Detail
  if (url.match(/^\/v1\/products\/p[0-9]+$/)) {
    const id = url.split('/').pop();
    const product = mockProducts.find(p => p.id === id);
    if (product) return buildResponse(product);
    throw new Error('Product not found');
  }

  // Inventory
  if (url.match(/^\/v1\/inventory\/.*\/p[0-9]+$/)) {
    const id = url.split('/').pop();
    const product = mockProducts.find(p => p.id === id);
    return buildResponse({ isAvailable: product?.isAvailable || false });
  }

  // Orders List
  if (url.startsWith('/v1/orders') && !url.includes('reorder')) {
    const isDetail = url.split('/').length > 3;
    if (isDetail) {
      const id = url.split('/').pop();
      const order = mockOrders.find(o => o.id === id);
      if (order) return buildResponse(order);
      throw new Error('Order not found');
    }
    return buildResponse(mockOrders);
  }

  console.warn('Unhandled mock GET:', url);
  return buildResponse(null);
};

export const mockPost = async (url: string, data?: any, config?: any) => {
  await delay(800);

  // Intent / Search
  if (url.startsWith('/v1/intent/text')) {
    const text = data?.transcript?.toLowerCase() || '';
    if (text.includes('milk')) {
      return buildResponse({ confidence: 0.9, productId: 'p1' });
    }
    if (text.includes('snack')) {
      return buildResponse({ confidence: 0.6, productId: 'p2', alternatives: ['p7'] });
    }
    return buildResponse({ confidence: 0.3, suggestion: 'Try searching for milk or snacks' });
  }

  // Smart Cart Refresh
  if (url.startsWith('/v1/smart-cart/refresh')) {
    return buildResponse({
      tier: 'Your Smart Cart',
      explanation: 'Updated recommendations',
      products: mockProducts.slice(2, 6)
    });
  }

  // Create Order
  if (url === '/v1/orders') {
    if (!data.items || data.items.length === 0) {
       return Promise.reject({ response: { data: { error: 'EMPTY_CART' } } });
    }
    const newOrder = {
      id: `ord_${Math.random().toString(36).substring(7)}`,
      items: data.items,
      total: data.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0),
      status: 'CONFIRMED',
      etaAt: new Date(Date.now() + 10 * 60000).toISOString(),
      date: new Date().toISOString(),
    };
    mockOrders.unshift(newOrder);
    return buildResponse(newOrder);
  }

  // Reorder
  if (url.match(/^\/v1\/orders\/.*\/reorder$/)) {
    const id = url.split('/')[3];
    const oldOrder = mockOrders.find(o => o.id === id);
    if (!oldOrder) throw new Error('Order not found');
    
    const newOrder = {
      ...oldOrder,
      id: `ord_${Math.random().toString(36).substring(7)}`,
      status: 'CONFIRMED',
      etaAt: new Date(Date.now() + 10 * 60000).toISOString(),
      date: new Date().toISOString(),
    };
    mockOrders.unshift(newOrder);
    return buildResponse(newOrder);
  }

  console.warn('Unhandled mock POST:', url);
  return buildResponse(null);
};
