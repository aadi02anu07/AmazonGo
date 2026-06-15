'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mic, Search, ChevronRight, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { usePincodeStore } from '@/store/usePincodeStore';
import { useAuthStore } from '@/store/useAuthStore';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';

export default function Home() {
  const router = useRouter();
  const { pincode, setPincode } = usePincodeStore();
  const { isLoggedIn } = useAuthStore();
  
  const [heroPincode, setHeroPincode] = useState('');
  const [intentQuery, setIntentQuery] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Queries
  const { data: etaData } = useQuery({
    queryKey: ['eta', pincode],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/eta?pincode=${pincode}`);
      return res.data;
    },
    enabled: !!pincode,
  });

  const { data: trendingRes, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending', pincode],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/products/trending?pincode=${pincode}`);
      return res.data;
    },
    enabled: !!pincode,
  });

  const { data: smartCartRes, isLoading: smartCartLoading } = useQuery({
    queryKey: ['smart-cart', pincode],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/smart-cart?pincode=${pincode}`);
      return res.data;
    },
    enabled: isLoggedIn,
  });

  const handleHeroPincodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(heroPincode)) {
      setPincode(heroPincode);
    } else {
      alert('Enter a valid 6-digit pincode');
    }
  };

  const handleIntentSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!intentQuery.trim()) return;

    try {
      const res = await apiClient.post('/v1/intent/text', { transcript: intentQuery, pincode });
      const { confidence, productId, alternatives, suggestion } = res.data.data;

      if (confidence >= 0.75 && productId) {
        router.push(`/products/${productId}`);
      } else if (confidence >= 0.50 && confidence < 0.75) {
        router.push(`/intent-result?productId=${productId}&alternatives=${alternatives?.join(',') || ''}`);
      } else {
        router.push(`/intent-result?failed=true&suggestion=${encodeURIComponent(suggestion || '')}`);
      }
    } catch (error) {
      console.error('Intent processing failed', error);
      router.push(`/products?q=${encodeURIComponent(intentQuery)}`);
    }
  };

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIntentQuery(transcript);
      // Wait slightly then submit
      setTimeout(() => {
        // Mock submitting since state might not update immediately for the direct call
        apiClient.post('/v1/intent/text', { transcript, pincode }).then(res => {
          const { confidence, productId, alternatives, suggestion } = res.data.data;
          if (confidence >= 0.75 && productId) router.push(`/products/${productId}`);
          else if (confidence >= 0.50) router.push(`/intent-result?productId=${productId}&alternatives=${alternatives?.join(',') || ''}`);
          else router.push(`/intent-result?failed=true&suggestion=${encodeURIComponent(suggestion || '')}`);
        });
      }, 100);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const categories = [
    { name: 'Grocery', path: 'grocery', emoji: '🛒' },
    { name: 'Medicine', path: 'medicine', emoji: '💊' },
    { name: 'Snacks', path: 'snacks', emoji: '🍿' },
    { name: 'Beverages', path: 'snacks&subCategory=beverages', emoji: '🥤' },
    { name: 'Household', path: 'household', emoji: '🏠' },
    { name: 'Baby Care', path: 'personal-care&subCategory=baby', emoji: '👶' },
    { name: 'Personal Care', path: 'personal-care', emoji: '🧴' },
    { name: 'Dairy', path: 'grocery&subCategory=dairy', emoji: '🥛' },
  ];

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* 1. HERO SECTION */}
      <section className="bg-card py-12 md:py-20 relative overflow-hidden">
        {/* Asymmetric graphic elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cta/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="container mx-auto px-4 lg:px-8 relative z-10 max-w-4xl text-center">
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-cta leading-tight mb-4 tracking-tight">
            Freshness,<br />Delivered Fast.
          </h1>
          <p className="text-lg md:text-xl text-subtext mb-8 font-medium">
            Everything you need in 10 minutes.
          </p>
          
          <div className="max-w-md mx-auto bg-white p-2 rounded-full shadow-lg border border-card flex items-center">
            {pincode ? (
              <div className="flex-1 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <Clock className="text-primary" size={20} />
                  <span className="font-bold text-cta">
                    {etaData?.data?.etaMinutes ? `Delivering in ${etaData.data.etaMinutes} min` : 'Calculating ETA...'}
                  </span>
                </div>
                <button onClick={() => router.push('/products')} className="bg-cta text-white px-6 py-2 rounded-full font-bold hover:bg-opacity-90 transition-colors">
                  Shop Now
                </button>
              </div>
            ) : (
              <form onSubmit={handleHeroPincodeSubmit} className="flex-1 flex">
                <input
                  type="text"
                  placeholder="Enter your pincode"
                  className="flex-1 px-4 py-2 focus:outline-none rounded-l-full bg-transparent"
                  value={heroPincode}
                  onChange={(e) => setHeroPincode(e.target.value)}
                  maxLength={6}
                />
                <button type="submit" className="bg-primary text-cta px-6 py-2 rounded-full font-bold hover:bg-yellow-500 transition-colors">
                  Check
                </button>
              </form>
            )}
          </div>
        </div>
        {/* Torn paper effect bottom */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none rotate-180">
          <svg className="relative block w-full h-[30px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="#FEFAF0"></path>
          </svg>
        </div>
      </section>

      {/* 2. INTENT BAR */}
      <section className="container mx-auto px-4 lg:px-8 py-8 -mt-6 relative z-20">
        <form onSubmit={handleIntentSubmit} className="max-w-2xl mx-auto relative shadow-xl rounded-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={22} className="text-subtext" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-14 py-4 bg-white border-2 border-primary/20 rounded-full text-lg placeholder-subtext focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 shadow-sm transition-all"
            placeholder="I want to make pasta tonight..."
            value={intentQuery}
            onChange={(e) => setIntentQuery(e.target.value)}
          />
          <button
            type="button"
            onClick={handleVoiceSearch}
            className={`absolute inset-y-0 right-2 px-3 flex items-center ${isListening ? 'text-red-500 animate-pulse' : 'text-cta hover:text-primary'} transition-colors`}
          >
            <Mic size={24} />
          </button>
        </form>
      </section>

      {/* 3. TRENDING NOW */}
      <section className="container mx-auto px-4 lg:px-8 py-10">
        <div className="flex justify-between items-end mb-6">
          <h2 className="font-serif text-3xl font-bold text-cta">Trending Now</h2>
          <Link href="/products" className="text-sm font-bold text-subtext hover:text-primary flex items-center">
            View All <ChevronRight size={16} />
          </Link>
        </div>
        
        <div className="flex overflow-x-auto pb-6 -mx-4 px-4 snap-x gap-4 no-scrollbar">
          {trendingLoading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="w-[200px] flex-shrink-0 snap-start">
                <ProductCardSkeleton />
              </div>
            ))
          ) : (trendingRes?.data as any[])?.map((product: any) => (
            <div key={product.id} className="w-[200px] flex-shrink-0 snap-start">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </section>

      {/* 4. CATEGORY GRID */}
      <section className="bg-card py-12 mt-4 relative">
        <div className="absolute top-0 left-0 w-full overflow-hidden leading-none">
          <svg className="relative block w-full h-[30px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V3C1132.19,26.09,1055.71,18.48,985.66,92.83Z" fill="#FEFAF0"></path>
          </svg>
        </div>
        <div className="container mx-auto px-4 lg:px-8 pt-6">
          <h2 className="font-serif text-3xl font-bold text-cta text-center mb-10">Shop by Category</h2>
          <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-4 md:gap-6">
            {categories.map((cat, idx) => (
              <Link 
                key={idx} 
                href={`/products?category=${cat.path}`}
                className="flex flex-col items-center group"
              >
                <div className="w-16 h-16 md:w-24 md:h-24 bg-background rounded-full shadow-sm mb-3 group-hover:shadow-md group-hover:scale-105 transition-all flex items-center justify-center border border-primary/20">
                  <span className="text-3xl md:text-4xl" role="img" aria-label={cat.name}>{cat.emoji}</span>
                </div>
                <span className="text-xs md:text-sm font-bold text-center text-cta group-hover:text-primary transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 5. SMART CART STRIP */}
      {isLoggedIn && smartCartRes?.data?.products?.length > 0 && (
        <section className="container mx-auto px-4 lg:px-8 py-16">
          <div className="bg-gradient-to-r from-card to-background border-2 border-primary/30 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
              <div>
                <span className="inline-block px-3 py-1 bg-primary/20 text-cta text-xs font-bold uppercase tracking-widest rounded-full mb-3">
                  {smartCartRes.data.tier}
                </span>
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-cta">Your Smart Cart</h2>
                <p className="text-subtext mt-1">{smartCartRes.data.explanation}</p>
              </div>
              <Link href="/smart-cart" className="bg-cta text-white px-6 py-2.5 rounded-full font-bold hover:bg-opacity-90 transition-colors flex items-center gap-2">
                Open Smart Cart <ChevronRight size={18} />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {smartCartRes.data.products.slice(0, 4).map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
