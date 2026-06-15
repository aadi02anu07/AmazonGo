'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { usePincodeStore } from '@/store/usePincodeStore';
import { useAuthStore } from '@/store/useAuthStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ProductCard } from '@/components/ProductCard';
import { Sparkles, RefreshCw, Zap, CheckCircle } from 'lucide-react';

export default function SmartCartPage() {
  const router = useRouter();
  const { pincode } = usePincodeStore();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');

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

  const quickOrderMutation = useMutation({
    mutationFn: async () => {
      const products = smartCartRes?.data?.products || [];
      const items = products
        .filter((p: any) => p.isAvailable !== false)
        .map((p: any) => ({ productId: p.id || p.productId, quantity: 1 }));

      if (items.length === 0) throw new Error('No available products to order');

      const res = await apiClient.post('/v1/orders', {
        items,
        pincode,
        addressId: 'Smart Cart Quick Order',
        paymentMethod: 'cod',
      });
      return res.data;
    },
    onSuccess: () => {
      setOrderSuccess(true);
      setOrderError('');
    },
    onError: (err: any) => {
      setOrderError(err.message || 'Order failed. Please try again.');
    },
  });

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
                {smartCart?.explanation || "Based on your previous orders and what's popular near you."}
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
              {orderSuccess ? (
                <div className="px-6 py-3 bg-green-100 text-green-700 rounded-full font-bold flex items-center gap-2">
                  <CheckCircle size={18} /> Order Placed!
                </div>
              ) : (
                <button 
                  onClick={() => quickOrderMutation.mutate()}
                  disabled={quickOrderMutation.isPending || !pincode}
                  className="px-6 py-3 bg-cta text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-opacity-90 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Zap size={18} /> 
                  {quickOrderMutation.isPending ? 'Placing Order...' : 'Quick Order (COD)'}
                </button>
              )}
            </div>
          </div>

          {orderError && (
            <div className="relative z-10 mt-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm font-medium">
              {orderError}
            </div>
          )}
        </div>

        {smartCart?.products?.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {smartCart.products.map((product: any) => (
              <ProductCard key={product.id || product.productId} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-subtext">
            No recommendations available right now. Keep shopping to help us learn what you like!
          </div>
        )}
      </div>

      {/* Order Success Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setOrderSuccess(false)}>
          <div
            className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-green-600" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-cta mb-3">Order Placed!</h2>
            <p className="text-subtext text-lg mb-2">Your Smart Cart order has been placed successfully.</p>
            <p className="text-subtext text-sm mb-8">Payment: <span className="font-bold text-cta">Cash on Delivery</span></p>
            <div className="flex gap-3">
              <button
                onClick={() => { setOrderSuccess(false); router.push('/orders'); }}
                className="flex-1 py-3 bg-cta text-white rounded-full font-bold hover:bg-opacity-90 transition-colors"
              >
                View Orders
              </button>
              <button
                onClick={() => setOrderSuccess(false)}
                className="flex-1 py-3 border-2 border-cta text-cta rounded-full font-bold hover:bg-card transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
