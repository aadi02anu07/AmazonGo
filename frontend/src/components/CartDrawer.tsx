'use client';

import { useCartStore } from '@/store/useCartStore';
import { formatPrice } from '@/lib/utils';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

export function CartDrawer() {
  const { items, isDrawerOpen, toggleDrawer, updateQty, removeItem, totalPrice } = useCartStore();
  const { isLoggedIn } = useAuthStore();
  const router = useRouter();

  const handleCheckout = () => {
    toggleDrawer(false);
    if (isLoggedIn) {
      router.push('/checkout');
    } else {
      router.push('/login?redirect=/checkout');
    }
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => toggleDrawer(false)}
            className="fixed inset-0 bg-black/50 z-40"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-background shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-card">
              <h2 className="text-xl font-serif font-bold flex items-center gap-2">
                <ShoppingBag size={24} />
                Your Cart
              </h2>
              <button
                onClick={() => toggleDrawer(false)}
                className="p-2 hover:bg-card rounded-full transition-colors"
                aria-label="Close cart"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-subtext space-y-4">
                  <ShoppingBag size={64} className="opacity-20" />
                  <p className="text-lg">Your cart is empty</p>
                  <button
                    onClick={() => {
                      toggleDrawer(false);
                      router.push('/products');
                    }}
                    className="px-6 py-2 bg-primary text-cta rounded-full font-bold hover:bg-yellow-500 transition-colors"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-4 p-3 bg-white rounded-xl shadow-sm border border-card">
                      <div className="relative w-20 h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                        <Image src={item.image} alt={item.name} fill className="object-contain p-1" />
                      </div>
                      <div className="flex flex-col flex-grow justify-between">
                        <div className="flex justify-between items-start">
                          <Link 
                            href={`/products/${item.id}`} 
                            onClick={() => toggleDrawer(false)}
                            className="text-sm font-medium line-clamp-2 hover:underline"
                          >
                            {item.name}
                          </Link>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-subtext hover:text-red-500 p-1"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3 bg-card rounded-full px-2 py-1">
                            <button
                              onClick={() => updateQty(item.id, item.quantity - 1)}
                              className="text-cta hover:bg-white rounded-full p-0.5"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQty(item.id, item.quantity + 1)}
                              className="text-cta hover:bg-white rounded-full p-0.5"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-card p-4 bg-white space-y-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-subtext">
                    <span>Subtotal</span>
                    <span>{formatPrice(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-subtext">
                    <span>Delivery</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-card">
                    <span>Total</span>
                    <span>{formatPrice(totalPrice)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/cart"
                    onClick={() => toggleDrawer(false)}
                    className="flex items-center justify-center py-3 px-4 rounded-full border border-cta text-cta font-bold hover:bg-card transition-colors text-sm"
                  >
                    View Cart
                  </Link>
                  <button
                    onClick={handleCheckout}
                    className="flex items-center justify-center py-3 px-4 rounded-full bg-cta text-background font-bold hover:bg-opacity-90 transition-colors text-sm"
                  >
                    Checkout
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
