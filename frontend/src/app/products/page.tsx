'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { usePincodeStore } from '@/store/usePincodeStore';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { Filter, Search as SearchIcon } from 'lucide-react';

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { pincode } = usePincodeStore();

  const initialQ = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';
  
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState(initialCategory);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');

  useEffect(() => {
    setQ(searchParams.get('q') || '');
    setCategory(searchParams.get('category') || '');
  }, [searchParams]);

  const { data: productsRes, isLoading } = useQuery({
    queryKey: ['products', q, category, pincode],
    queryFn: async () => {
      let endpoint: string;
      if (q) {
        // Search requires a query term
        endpoint = `/v1/products/search?q=${encodeURIComponent(q)}&pincode=${pincode}${category ? `&category=${encodeURIComponent(category)}` : ''}`;
      } else {
        // No query — use trending (category filter applied client-side)
        endpoint = `/v1/products/trending?pincode=${pincode}`;
      }
      const res = await apiClient.get(endpoint);
      return res.data;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    router.push(`/products?${params.toString()}`);
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (newCat) params.set('category', newCat);
    router.push(`/products?${params.toString()}`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let displayProducts: any[] = productsRes?.data?.products || productsRes?.data?.results || productsRes?.data || [];
  
  // Apply category filter client-side when browsing by category without search
  if (category && !q) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    displayProducts = displayProducts.filter((p: any) => p.category === category);
  }

  if (inStockOnly) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    displayProducts = displayProducts.filter((p: any) => p.isAvailable);
  }

  if (sortBy === 'price-low') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    displayProducts = [...displayProducts].sort((a: any, b: any) => a.price - b.price);
  } else if (sortBy === 'price-high') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    displayProducts = [...displayProducts].sort((a: any, b: any) => b.price - a.price);
  }

  const categories = ['grocery', 'medicine', 'snacks', 'household', 'personal-care'];

  return (
    <div className="container mx-auto px-4 lg:px-8 py-8">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-card p-4 rounded-2xl border border-primary/10">
        <form onSubmit={handleSearch} className="relative w-full md:w-1/2">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon size={18} className="text-subtext" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-4 py-2.5 bg-white border-0 rounded-full text-sm placeholder-subtext focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            placeholder="Search products..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white border-0 text-sm rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm text-cta font-medium"
          >
            <option value="relevance">Relevance</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-card p-6 rounded-2xl border border-primary/10 sticky top-24">
            <div className="flex items-center gap-2 font-serif font-bold text-lg text-cta mb-4">
              <Filter size={20} /> Filters
            </div>
            
            <div className="mb-6 border-b border-background pb-6">
              <h3 className="font-bold text-sm text-subtext uppercase tracking-wider mb-3">Availability</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-10 h-6 bg-background rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1 after:left-1 after:bg-subtext peer-checked:after:bg-primary after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner"></div>
                </div>
                <span className="text-sm font-medium text-cta">In Stock Only</span>
              </label>
            </div>

            <div>
              <h3 className="font-bold text-sm text-subtext uppercase tracking-wider mb-3">Categories</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="category"
                    checked={category === ''}
                    onChange={() => handleCategoryChange('')}
                    className="w-4 h-4 text-primary bg-background border-subtext focus:ring-primary focus:ring-2 accent-primary"
                  />
                  <span className={`text-sm font-medium ${category === '' ? 'text-cta font-bold' : 'text-subtext group-hover:text-cta'}`}>All Categories</span>
                </label>
                {categories.map((cat) => (
                  <label key={cat} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="category"
                      checked={category === cat}
                      onChange={() => handleCategoryChange(cat)}
                      className="w-4 h-4 text-primary bg-background border-subtext focus:ring-primary focus:ring-2 accent-primary"
                    />
                    <span className={`text-sm font-medium capitalize ${category === cat ? 'text-cta font-bold' : 'text-subtext group-hover:text-cta'}`}>
                      {cat.replace('-', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="mb-6 flex justify-between items-end">
            <h1 className="font-serif text-3xl font-bold text-cta">
              {q ? `Search results for &quot;${q}&quot;` : category ? `${category.replace('-', ' ')}` : 'Trending Products'}
            </h1>
            <span className="text-sm font-medium text-subtext">{displayProducts.length} items</span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {Array(8).fill(0).map((_, i) => (
                <div key={i}><ProductCardSkeleton /></div>
              ))}
            </div>
          ) : displayProducts.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {displayProducts.map((product: any) => (
                <div key={product.productId || product.id}><ProductCard product={product} /></div>
              ))}
            </div>
          ) : (
            <div className="bg-card p-12 rounded-3xl text-center flex flex-col items-center justify-center border border-primary/20">
              <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mb-4">
                <SearchIcon size={32} className="text-subtext opacity-50" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-cta mb-2">No products found</h3>
              <p className="text-subtext max-w-md">Try checking your spelling, using more general terms, or clear your filters.</p>
              <button 
                onClick={() => { setQ(''); setCategory(''); setInStockOnly(false); router.push('/products'); }}
                className="mt-6 px-6 py-2 border-2 border-cta text-cta font-bold rounded-full hover:bg-cta hover:text-white transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i}><ProductCardSkeleton /></div>
          ))}
        </div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
