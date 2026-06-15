'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCartStore } from '@/store/useCartStore';
import { formatPrice } from '@/lib/utils';
import { Plus } from 'lucide-react';

// Emoji fallbacks by category
const CATEGORY_EMOJI: Record<string, string> = {
  grocery: '🛒',
  medicine: '💊',
  snacks: '🍿',
  household: '🏠',
  'personal-care': '🧴',
  beverages: '🥤',
  dairy: '🥛',
  default: '🛍️',
};

interface ProductCardProps {
  product: {
    id?: string;
    productId?: string;
    name: string;
    price: number;
    mrp?: number;
    image?: string;
    imageUrl?: string;
    imageUrls?: string[];
    isAvailable?: boolean;
    category?: string;
    subCategory?: string;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [imgError, setImgError] = useState(false);

  // Normalize field names — API returns productId/imageUrl, mock uses id/image
  const productId = product.id || product.productId || '';
  const imageUrl = product.image || product.imageUrl || (product.imageUrls?.[0]) || '';
  const isAvailable = product.isAvailable !== false;
  const emoji = CATEGORY_EMOJI[product.subCategory || ''] || CATEGORY_EMOJI[product.category || ''] || CATEGORY_EMOJI.default;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAvailable) return;
    addItem({
      id: productId,
      name: product.name,
      price: product.price,
      image: imageUrl,
    });
  };

  return (
    <Link href={`/products/${productId}`} className="group relative flex flex-col rounded-xl bg-card p-3 transition-transform hover:scale-[1.02] hover:shadow-md h-full">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-white mb-3">
        {imageUrl && !imgError ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-contain p-2"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-amber-50 flex items-center justify-center">
            <span className="text-5xl" role="img" aria-label={product.name}>{emoji}</span>
          </div>
        )}
        {!isAvailable && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-bold bg-red-600 px-2 py-1 rounded text-xs uppercase">Out of Stock</span>
          </div>
        )}
        {isAvailable && (
          <div className="absolute top-2 left-2 bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
            10 MINS
          </div>
        )}
      </div>
      <div className="flex-grow flex flex-col justify-between">
        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-tight mb-2">
          {product.name}
        </h3>
        <div className="flex items-end justify-between mt-auto">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground">{formatPrice(product.price)}</span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-xs text-subtext line-through">{formatPrice(product.mrp)}</span>
            )}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-cta hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Add to cart"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl bg-card p-3 animate-pulse h-full">
      <div className="aspect-square w-full rounded-lg bg-gray-300 mb-3" />
      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2" />
      <div className="h-4 bg-gray-300 rounded w-1/2 mb-4" />
      <div className="flex justify-between items-end mt-auto">
        <div className="h-5 bg-gray-300 rounded w-16" />
        <div className="h-8 w-8 bg-gray-300 rounded-full" />
      </div>
    </div>
  );
}
