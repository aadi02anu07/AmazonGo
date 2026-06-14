'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Package, RotateCcw, ChevronRight } from 'lucide-react';

export default function OrdersPage() {
  const router = useRouter();

  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/orders?limit=20');
      return res.data;
    },
  });

  const handleReorder = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    try {
      const res = await apiClient.post(`/v1/orders/${orderId}/reorder`);
      router.push(`/orders/${res.data.data.id}`);
    } catch (err) {
      alert('Failed to reorder. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl animate-pulse">
        <div className="h-10 bg-card rounded w-48 mb-8"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-card rounded-2xl"></div>)}
        </div>
      </div>
    );
  }

  const orders = ordersRes?.data || [];

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 lg:px-8 py-10 max-w-4xl pb-20">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-cta mb-8">Order History</h1>

        {orders.length === 0 ? (
          <div className="bg-card rounded-3xl p-12 text-center border border-primary/20">
            <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto mb-6">
              <Package size={32} className="text-subtext opacity-50" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-cta mb-2">No orders yet</h2>
            <p className="text-subtext mb-8">Looks like you haven't placed any orders with us yet.</p>
            <Link href="/products" className="bg-cta text-white px-8 py-3 rounded-full font-bold hover:bg-opacity-90 transition-colors inline-block">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order: any) => (
              <div 
                key={order.id} 
                onClick={() => router.push(`/orders/${order.id}`)}
                className="bg-white border border-card rounded-2xl p-6 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-card pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-cta text-lg">Order #{order.id.substring(0, 8)}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${order.status === 'DELIVERED' ? 'bg-green-100 text-green-800' : 'bg-primary/20 text-cta'}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-sm text-subtext">{new Date(order.date).toLocaleDateString()} at {new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xl text-cta">{formatPrice(order.total)}</div>
                    <span className="text-sm text-subtext">{order.items.length} items</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex -space-x-2 overflow-hidden">
                    {order.items.slice(0, 4).map((item: any, i: number) => (
                      <div key={i} className="inline-block h-10 w-10 rounded-full bg-card border-2 border-white relative overflow-hidden">
                        <img src={item.image || 'https://via.placeholder.com/150'} alt={item.name} className="object-contain w-full h-full p-1" />
                      </div>
                    ))}
                    {order.items.length > 4 && (
                      <div className="inline-block h-10 w-10 rounded-full bg-background border-2 border-white flex items-center justify-center text-xs font-bold text-subtext">
                        +{order.items.length - 4}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={(e) => handleReorder(e, order.id)}
                      className="hidden sm:flex px-4 py-2 bg-card text-cta rounded-full font-bold text-sm items-center gap-2 hover:bg-primary/20 transition-colors"
                    >
                      <RotateCcw size={14} /> Reorder
                    </button>
                    <div className="w-10 h-10 rounded-full bg-card text-cta flex items-center justify-center group-hover:bg-primary group-hover:text-background transition-colors">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
