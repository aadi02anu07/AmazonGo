'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { useCartStore } from '@/store/useCartStore';
import { Search, ShoppingBag, ArrowRight } from 'lucide-react';

function IntentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addItem } = useCartStore();

  const productId = searchParams.get('productId');
  const alternativesStr = searchParams.get('alternatives');
  const failed = searchParams.get('failed') === 'true';
  const suggestion = searchParams.get('suggestion');

  const { data: productRes, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/products/${productId}`);
      return res.data;
    },
    enabled: !!productId,
  });

  const { data: altsRes } = useQuery({
    queryKey: ['products', 'alts', alternativesStr],
    queryFn: async () => {
      const altIds = alternativesStr!.split(',');
      const promises = altIds.map(id => apiClient.get(`/v1/products/${id}`).then(r => r.data.data).catch(() => null));
      const results = await Promise.all(promises);
      return { data: results.filter(Boolean) };
    },
    enabled: !!alternativesStr,
  });

  if (failed) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
        <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mx-auto mb-6">
          <Search size={40} className="text-cta" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-cta mb-4">We didn&apos;t quite get that</h1>
        <p className="text-subtext mb-8 text-lg">
          We couldn&apos;t find a confident match for your search. {suggestion && <span className="font-bold text-cta block mt-2">Suggestion: {suggestion}</span>}
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/" className="px-6 py-3 bg-cta text-white rounded-full font-bold hover:bg-opacity-90">
            Try Again
          </Link>
          <Link href="/products" className="px-6 py-3 border-2 border-cta text-cta rounded-full font-bold hover:bg-card">
            Browse All
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="container mx-auto px-4 py-20 text-center animate-pulse">Loading matches...</div>;
  }

  const product = productRes?.data;

  return (
    <div className="container mx-auto px-4 lg:px-8 py-10">
      <h1 className="font-serif text-3xl font-bold text-cta mb-8">We found what you&apos;re looking for!</h1>

      {product && (
        <div className="bg-card rounded-3xl p-6 md:p-10 flex flex-col md:flex-row gap-8 items-center border border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="w-full md:w-1/3 aspect-square relative bg-white rounded-2xl shadow-sm z-10">
            <Image src={product.image} alt={product.name} fill className="object-contain p-4" />
          </div>
          
          <div className="w-full md:w-2/3 z-10">
            <div className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-bold uppercase tracking-widest rounded-full mb-4">
              Best Match
            </div>
            <h2 className="font-serif text-4xl font-bold text-cta mb-4">{product.name}</h2>
            <div className="text-3xl font-bold text-cta mb-8">₹{(product.price / 100).toFixed(2)}</div>
            
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  addItem({ ...product, quantity: 1 });
                  router.push('/cart');
                }}
                className="flex-1 bg-cta text-white py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-opacity-90 transition-colors"
              >
                <ShoppingBag size={20} /> Add &amp; Checkout
              </button>
              <Link 
                href={`/products/${product.id}`}
                className="w-16 flex items-center justify-center bg-white border border-cta text-cta rounded-full hover:bg-card transition-colors"
              >
                <ArrowRight size={24} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {altsRes?.data && altsRes.data.length > 0 && (
        <div className="mt-16">
          <h2 className="font-serif text-2xl font-bold text-cta mb-6">Also consider</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {altsRes.data.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntentResultPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-20 text-center animate-pulse">Loading...</div>}>
      <IntentResultContent />
    </Suspense>
  );
}
