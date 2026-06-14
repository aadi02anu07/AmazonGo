'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { usePincodeStore } from '@/store/usePincodeStore';
import { useCartStore } from '@/store/useCartStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ProductCard } from '@/components/ProductCard';
import { Sparkles, RefreshCw, ShoppingBag } from 'lucide-react';

export default function SmartCartPage() {
  const router = useRouter();
  const { pincode } = usePincodeStore();
  const { addItem, toggleDrawer } = useCartStore();
  const queryClient = useQueryClient();

  const { data: smartCartRes, isLoading } = useQuery({
    queryKey: ['smart-cart', pincode],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/smart-cart?pincode=${pincode}`);
      return res.data;
    },
    enabled: !!pincode,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/v1/smart-cart/refresh', { pincode });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['smart-cart', pincode], data);
    },
  });

  const handleAddAll = () => {
    if (!smartCartRes?.data?.products) return;
    
    smartCartRes.data.products.forEach((product: any) => {
      if (product.isAvailable) {
        addItem({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: 1,
        });
      }
    });
    toggleDrawer(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-5xl animate-pulse">
        <div className="h-10 bg-card w-1/3 mb-4 rounded"></div>
        <div className="h-4 bg-card w-1/4 mb-8 rounded"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-64 bg-card rounded-2xl"></div>)}
        </div>
      </div>
    );
  }

  const smartCart = smartCartRes?.data;

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 lg:px-8 py-10 max-w-5xl pb-20">
        <div className="bg-gradient-to-br from-card to-background border border-primary/20 rounded-3xl p-8 mb-10 shadow-sm relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-cta text-xs font-bold uppercase tracking-widest rounded-full mb-4 shadow-sm border border-primary/10">
                <Sparkles size={14} className="text-primary" />
                {smartCart?.tier || 'Your Smart Cart'}
              </div>
              <h1 className="font-serif text-3xl md:text-5xl font-bold text-cta mb-2">
                Curated for you
              </h1>
              <p className="text-subtext text-lg max-w-xl">
                {smartCart?.explanation || 'Based on your previous orders and what\'s popular near you.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button 
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="px-6 py-3 bg-white border border-card text-cta rounded-full font-bold flex items-center justify-center gap-2 hover:bg-card transition-colors disabled:opacity-50 shadow-sm"
              >
                <RefreshCw size={18} className={refreshMutation.isPending ? 'animate-spin' : ''} /> 
                Refresh
              </button>
              <button 
                onClick={handleAddAll}
                className="px-6 py-3 bg-cta text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-opacity-90 transition-colors shadow-sm"
              >
                <ShoppingBag size={18} /> Add All to Cart
              </button>
            </div>
          </div>
        </div>

        {smartCart?.products?.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {smartCart.products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-subtext">
            No recommendations available right now. Keep shopping to help us learn what you like!
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
