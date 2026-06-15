'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useCartStore } from '@/store/useCartStore';
import { usePincodeStore } from '@/store/usePincodeStore';
import { formatPrice } from '@/lib/utils';
import { ProductCard } from '@/components/ProductCard';
import { ChevronRight, Home, Minus, Plus, ShoppingBag, Clock } from 'lucide-react';

export default function ProductDetailPage() {
  const { productId } = useParams();
  const router = useRouter();
  const { pincode } = usePincodeStore();
  const { addItem, toggleDrawer } = useCartStore();
  
  const [qty, setQty] = useState(1);

  const { data: productRes, isLoading: productLoading, error: productError } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/products/${productId}`);
      return res.data;
    },
  });

  const { data: inventoryRes } = useQuery({
    queryKey: ['inventory', pincode, productId],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/inventory/${pincode}/${productId}`);
      return res.data;
    },
    enabled: !!pincode && !!productId,
    retry: false, // don't retry on 422
  });

  const { data: etaData } = useQuery({
    queryKey: ['eta', pincode],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/eta?pincode=${pincode}`);
      return res.data;
    },
    enabled: !!pincode,
  });

  const { data: relatedRes } = useQuery({
    queryKey: ['related', productRes?.data?.category, pincode],
    queryFn: async () => {
      // Use trending endpoint and filter by category client-side
      // (search requires a query term, trending doesn't)
      const res = await apiClient.get(`/v1/products/trending?pincode=${pincode || '110024'}`);
      const allProducts = res.data?.data || [];
      const filtered = allProducts.filter((p: any) => p.category === productRes?.data?.category && p.id !== productId);
      return { data: { data: filtered } };
    },
    enabled: !!productRes?.data?.category,
  });

  if (productLoading) {
    return (
      <div className="container mx-auto px-4 lg:px-8 py-8 animate-pulse">
        <div className="h-6 bg-card rounded w-1/3 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="aspect-square bg-card rounded-2xl"></div>
          <div className="space-y-6">
            <div className="h-10 bg-card rounded w-3/4"></div>
            <div className="h-8 bg-card rounded w-1/4"></div>
            <div className="h-4 bg-card rounded w-1/2"></div>
            <div className="h-16 bg-card rounded w-full mt-10"></div>
          </div>
        </div>
      </div>
    );
  }

  if (productError || !productRes?.data) {
    return (
      <div className="container mx-auto px-4 lg:px-8 py-20 text-center flex flex-col items-center">
        <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl">📦</span>
        </div>
        <h1 className="font-serif text-3xl font-bold text-cta mb-2">Product Not Found</h1>
        <p className="text-subtext mb-8">We couldn't find the product you're looking for.</p>
        <Link href="/products" className="bg-cta text-white px-8 py-3 rounded-full font-bold hover:bg-opacity-90 transition-colors">
          Browse Products
        </Link>
      </div>
    );
  }

  const product = productRes.data;
  // Use inventory availability if explicitly returned, fallback to product's own flag
  const isAvailable = (inventoryRes?.data?.isAvailable !== undefined && inventoryRes?.data?.isAvailable !== null)
    ? inventoryRes.data.isAvailable
    : (product.isAvailable !== false);

  const handleAddToCart = () => {
    if (!isAvailable) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: qty,
    });
  };

  return (
    <div className="container mx-auto px-4 lg:px-8 py-6 pb-20">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm font-medium text-subtext mb-8 overflow-x-auto whitespace-nowrap pb-2">
        <Link href="/" className="flex items-center hover:text-primary"><Home size={16} className="mr-1" /> Home</Link>
        <ChevronRight size={16} className="mx-2 flex-shrink-0" />
        <Link href={`/products?category=${product.category}`} className="capitalize hover:text-primary">{product.category.replace('-', ' ')}</Link>
        <ChevronRight size={16} className="mx-2 flex-shrink-0" />
        <span className="text-cta line-clamp-1 truncate">{product.name}</span>
      </nav>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">
        {/* Left: Image Gallery (Simple single image for now) */}
        <div className="w-full lg:w-1/2">
          <div className="relative aspect-square bg-card rounded-3xl overflow-hidden border border-primary/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image || product.imageUrls?.[0] || 'https://placehold.co/400x400/F5F5DC/333?text=Product'} alt={product.name} className="w-full h-full object-contain p-8" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x400/F5F5DC/333?text=Product'; }} />
            {!isAvailable && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                <span className="text-white font-bold bg-red-600 px-4 py-2 rounded-lg tracking-widest uppercase">Out of Stock</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Details */}
        <div className="w-full lg:w-1/2 flex flex-col pt-2 md:pt-6">
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-cta leading-tight mb-4">
            {product.name}
          </h1>

          <div className="flex items-end gap-3 mb-6">
            <span className="text-3xl font-bold text-cta">{formatPrice(product.price)}</span>
            {product.mrp > product.price && (
              <span className="text-lg text-subtext line-through mb-1">{formatPrice(product.mrp)}</span>
            )}
            {product.mrp > product.price && (
              <span className="bg-primary/20 text-cta text-xs font-bold px-2 py-1 rounded mb-1 ml-2">
                {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {product.tags?.map((tag: string) => (
              <Link 
                key={tag} 
                href={`/products?q=${tag}`}
                className="bg-background border border-card px-3 py-1.5 rounded-full text-xs font-bold text-subtext hover:border-primary hover:text-cta transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>

          <div className="bg-card rounded-2xl p-4 md:p-6 mb-8 border border-primary/10">
            <div className="flex items-center gap-3 mb-4 text-cta">
              <Clock size={24} className="text-primary" />
              <div>
                <h4 className="font-bold">Fast Delivery</h4>
                <p className="text-sm text-subtext">
                  {etaData?.data?.etaMinutes ? `Arriving in ${etaData.data.etaMinutes} mins to ${pincode}` : 'Select pincode for ETA'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-cta pt-4 border-t border-background/50">
              <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <h4 className="font-bold text-sm uppercase tracking-wider">{isAvailable ? 'In Stock' : 'Currently Unavailable'}</h4>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-auto">
            <div className="flex items-center bg-card rounded-full p-1 border border-primary/10">
              <button 
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={!isAvailable || qty <= 1}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-cta hover:bg-background disabled:opacity-50 transition-colors"
              >
                <Minus size={20} />
              </button>
              <span className="w-12 text-center font-bold text-lg">{qty}</span>
              <button 
                onClick={() => setQty(Math.min(10, qty + 1))}
                disabled={!isAvailable || qty >= 10}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-cta hover:bg-background disabled:opacity-50 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!isAvailable}
              className="flex-1 h-14 bg-cta text-background rounded-full font-bold flex items-center justify-center gap-2 hover:bg-opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg"
            >
              <ShoppingBag size={20} /> Add to Cart
            </button>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedRes?.data && relatedRes.data.length > 1 && (
        <div className="mt-20">
          <h2 className="font-serif text-2xl font-bold text-cta mb-6">You might also like</h2>
          <div className="flex overflow-x-auto pb-6 -mx-4 px-4 snap-x gap-4 no-scrollbar">
            {relatedRes.data.filter((p: any) => p.id !== product.id).map((p: any) => (
              <div key={p.id} className="w-[200px] flex-shrink-0 snap-start">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
