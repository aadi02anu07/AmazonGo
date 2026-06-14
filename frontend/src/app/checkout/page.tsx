'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCartStore } from '@/store/useCartStore';
import { usePincodeStore } from '@/store/usePincodeStore';
import { apiClient } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MapPin, ChevronRight, AlertCircle, ShoppingBag } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCartStore();
  const { pincode } = usePincodeStore();
  
  const [address, setAddress] = useState('Flat 402, Sunshine Apartments, 5th Cross Road');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-bold text-cta mb-4">Your cart is empty</h1>
        <button onClick={() => router.push('/products')} className="bg-cta text-white px-6 py-2 rounded-full">
          Browse Products
        </button>
      </div>
    );
  }

  const handlePayment = async () => {
    setIsSubmitting(true);
    setError('');
    
    try {
      const res = await apiClient.post('/v1/orders', {
        items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
        pincode,
        addressId: address,
        paymentMethod: 'amazon_pay'
      });
      
      const newOrder = res.data.data;
      clearCart();
      router.push(`/orders/${newOrder.id}`);
    } catch (err: any) {
      console.error(err);
      if (err.response?.data?.error === 'EMPTY_CART') {
        setError('Your cart is empty. Please add items to checkout.');
      } else {
        setError('Payment failed. Please try again.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 lg:px-8 py-10 max-w-5xl">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-cta mb-8">Checkout</h1>
        
        {error && (
          <div className="bg-red-100 text-red-800 p-4 rounded-xl mb-6 flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-10">
          <div className="w-full lg:w-2/3 space-y-6">
            {/* Delivery Details */}
            <div className="bg-white border border-card rounded-3xl p-6 md:p-8 shadow-sm">
              <h2 className="font-serif text-2xl font-bold text-cta mb-6 flex items-center gap-2">
                <MapPin size={24} className="text-primary" /> Delivery Details
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-subtext mb-2">Pincode</label>
                  <div className="flex items-center gap-3">
                    <div className="bg-card px-4 py-2 rounded-lg font-medium text-cta flex-1 border border-primary/10">
                      {pincode || 'No pincode set'}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-subtext mb-2">Complete Address</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-card px-4 py-3 rounded-lg font-medium text-cta border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] resize-none"
                    placeholder="Enter your complete delivery address"
                  />
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-white border border-card rounded-3xl p-6 md:p-8 shadow-sm">
              <h2 className="font-serif text-2xl font-bold text-cta mb-6 flex items-center gap-2">
                <ShoppingBag size={24} className="text-primary" /> Order Summary
              </h2>
              
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-4 pb-4 border-b border-card last:border-0 last:pb-0">
                    <div className="w-16 h-16 bg-card rounded-lg relative flex-shrink-0 border border-primary/10">
                      <Image src={item.image} alt={item.name} fill className="object-contain p-1" />
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
            </div>
          </div>

          {/* Payment Details */}
          <div className="w-full lg:w-1/3">
            <div className="bg-card rounded-3xl p-6 md:p-8 sticky top-24 border border-primary/20">
              <h2 className="font-serif text-2xl font-bold text-cta mb-6">Payment</h2>
              
              <div className="space-y-4 mb-6 text-subtext">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium text-cta">{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span className="font-bold text-green-600">Free</span>
                </div>
              </div>
              
              <div className="border-t border-background/50 pt-4 mb-8 flex justify-between items-center">
                <span className="font-bold text-cta text-lg">Amount to Pay</span>
                <span className="font-bold text-cta text-2xl">{formatPrice(totalPrice)}</span>
              </div>
              
              <button
                onClick={handlePayment}
                disabled={isSubmitting || !address.trim() || !pincode}
                className="w-full py-4 bg-[#F5C842] text-[#241A00] rounded-full font-bold text-lg flex justify-center items-center gap-2 hover:bg-[#eec13c] transition-colors shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Processing...</span>
                ) : (
                  <>Pay with Amazon Pay <ChevronRight size={20} /></>
                )}
              </button>
              
              <p className="text-center text-xs text-subtext mt-4">
                By placing this order, you agree to our terms and conditions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
