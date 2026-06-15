'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { formatPrice } from '@/lib/utils';
import { ShoppingBag, Minus, Plus, X, ArrowRight } from 'lucide-react';

export default function CartPage() {
  const router = useRouter();
  const { items, updateQty, removeItem } = useCartStore();
  const { isLoggedIn } = useAuthStore();

  const totalPrice = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleCheckout = () => {
    if (isLoggedIn) router.push('/checkout');
    else router.push('/login?redirect=/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center flex flex-col items-center">
        <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mb-6">
          <ShoppingBag size={40} className="text-cta opacity-50" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-cta mb-4">Your cart is empty</h1>
        <p className="text-subtext mb-8">Looks like you haven't added anything yet.</p>
        <Link href="/products" className="bg-cta text-white px-8 py-3 rounded-full font-bold hover:bg-opacity-90 transition-colors">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 lg:px-8 py-10">
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-cta mb-8">Your Cart</h1>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="w-full lg:w-2/3 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-card rounded-2xl p-4 flex gap-4 shadow-sm relative pr-10">
              <button 
                onClick={() => removeItem(item.id)}
                className="absolute top-4 right-4 text-subtext hover:text-red-500 transition-colors"
                aria-label="Remove item"
              >
                <X size={20} />
              </button>
              
              <div className="w-24 h-24 bg-card rounded-xl relative overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image || 'https://placehold.co/96x96/F5F5DC/333?text=Item'} alt={item.name} className="w-full h-full object-contain p-2" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/96x96/F5F5DC/333?text=Item'; }} />
              </div>
              
              <div className="flex flex-col justify-between flex-grow">
                <div>
                  <Link href={`/products/${item.id}`} className="font-bold text-cta hover:text-primary transition-colors pr-6 block text-lg">
                    {item.name}
                  </Link>
                  <span className="text-sm text-subtext">{formatPrice(item.price)} each</span>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-4 bg-card rounded-full px-3 py-1.5 border border-primary/10">
                    <button onClick={() => updateQty(item.id, item.quantity - 1)} className="text-cta hover:bg-white rounded-full p-1 transition-colors">
                      <Minus size={16} />
                    </button>
                    <span className="font-bold text-cta w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, item.quantity + 1)} className="text-cta hover:bg-white rounded-full p-1 transition-colors">
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="font-bold text-xl text-cta">{formatPrice(item.price * item.quantity)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="w-full lg:w-1/3">
          <div className="bg-card rounded-3xl p-6 md:p-8 sticky top-24 border border-primary/20">
            <h2 className="font-serif text-2xl font-bold text-cta mb-6">Order Summary</h2>
            
            <div className="space-y-4 mb-6 text-subtext">
              <div className="flex justify-between">
                <span>Subtotal ({items.length} items)</span>
                <span className="font-medium text-cta">{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span className="font-bold text-green-600">Free</span>
              </div>
            </div>
            
            <div className="border-t border-background/50 pt-4 mb-8 flex justify-between items-center">
              <span className="font-bold text-cta text-lg">Total</span>
              <span className="font-bold text-cta text-2xl">{formatPrice(totalPrice)}</span>
            </div>
            
            <button
              onClick={handleCheckout}
              className="w-full py-4 bg-cta text-white rounded-full font-bold text-lg flex justify-center items-center gap-2 hover:bg-opacity-90 transition-colors shadow-md"
            >
              Checkout <ArrowRight size={20} />
            </button>
            
            <div className="mt-4 text-center">
              <Link href="/products" className="text-sm font-bold text-subtext hover:text-primary transition-colors">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
