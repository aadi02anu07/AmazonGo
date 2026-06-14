'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CheckCircle2, Clock, MapPin, Package, RotateCcw } from 'lucide-react';

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const router = useRouter();

  const { data: orderRes, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/orders/${orderId}`);
      return res.data;
    },
  });

  const handleReorder = async () => {
    try {
      const res = await apiClient.post(`/v1/orders/${orderId}/reorder`);
      router.push(`/orders/${res.data.data.id}`);
    } catch (err) {
      alert('Failed to reorder. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-pulse">
        <div className="w-24 h-24 bg-card rounded-full mx-auto mb-6"></div>
        <div className="h-8 bg-card w-64 mx-auto rounded mb-4"></div>
        <div className="h-4 bg-card w-48 mx-auto rounded"></div>
      </div>
    );
  }

  if (error || !orderRes?.data) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-bold text-cta mb-4">Order not found</h1>
        <Link href="/orders" className="bg-cta text-white px-6 py-2 rounded-full">Back to Orders</Link>
      </div>
    );
  }

  const order = orderRes.data;

  // Calculate minutes remaining
  const etaTime = new Date(order.etaAt).getTime();
  const now = new Date().getTime();
  const diffMins = Math.max(0, Math.floor((etaTime - now) / 60000));

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 lg:px-8 py-10 max-w-4xl">
        {/* Success Animation Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6"
          >
            <motion.div
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <CheckCircle2 size={50} className="text-green-600" />
            </motion.div>
          </motion.div>
          
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-cta mb-4">Order Confirmed!</h1>
          <p className="text-subtext text-lg">Thank you for shopping with Amazon Now Snap.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-gradient-to-r from-card to-background border-2 border-primary/30 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6 shadow-sm">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-primary/10">
                <Clock size={32} className="text-primary" />
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-xl font-bold text-cta mb-1">
                  {diffMins > 0 ? `Arriving in ~${diffMins} minutes` : 'Arriving soon'}
                </h2>
                <p className="text-subtext">Order Status: <span className="font-bold text-cta">{order.status.replace('_', ' ')}</span></p>
              </div>
            </div>

            <div className="bg-white border border-card rounded-3xl p-6 md:p-8 shadow-sm">
              <h3 className="font-serif text-2xl font-bold text-cta mb-6 flex items-center gap-2">
                <Package size={24} className="text-primary" /> Order Items
              </h3>
              
              <ul className="space-y-4">
                {order.items.map((item: any, idx: number) => (
                  <li key={idx} className="flex gap-4 pb-4 border-b border-card last:border-0 last:pb-0">
                    <div className="w-16 h-16 bg-card rounded-lg relative flex-shrink-0 border border-primary/10">
                      <Image src={item.image || 'https://via.placeholder.com/150'} alt={item.name} fill className="object-contain p-1" />
                    </div>
                    <div className="flex flex-col flex-grow justify-between">
                      <span className="font-bold text-cta text-sm">{item.name}</span>
                      <div className="flex justify-between items-end">
                        <span className="text-subtext text-sm">Qty: {item.quantity}</span>
                        <span className="font-bold text-cta">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              
              <div className="border-t border-card pt-4 mt-6 flex justify-between items-center text-lg font-bold text-cta">
                <span>Total Paid</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-card rounded-3xl p-6 border border-primary/10 shadow-sm">
              <h3 className="font-bold text-cta mb-4 flex items-center gap-2">
                <MapPin size={20} className="text-primary" /> Delivery Info
              </h3>
              <p className="text-sm text-subtext leading-relaxed">
                Will be delivered to the address associated with this order.
              </p>
            </div>
            
            <div className="bg-card rounded-3xl p-6 border border-primary/10 shadow-sm">
              <h3 className="font-bold text-cta mb-4">Order Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-subtext">Order ID</span>
                  <span className="font-medium text-cta">#{order.id.substring(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-subtext">Placed On</span>
                  <span className="font-medium text-cta">{new Date(order.date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button 
                onClick={handleReorder}
                className="w-full py-4 bg-white border-2 border-cta text-cta rounded-full font-bold flex items-center justify-center gap-2 hover:bg-card transition-colors shadow-sm"
              >
                <RotateCcw size={18} /> Reorder
              </button>
              <Link 
                href="/"
                className="w-full py-4 bg-cta text-white rounded-full font-bold text-center hover:bg-opacity-90 transition-colors shadow-sm"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
