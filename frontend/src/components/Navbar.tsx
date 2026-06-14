'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { usePincodeStore } from '@/store/usePincodeStore';
import { Search, Mic, ShoppingBag, MapPin, User, Menu } from 'lucide-react';

export function Navbar() {
  const router = useRouter();
  const { totalCount, toggleDrawer } = useCartStore();
  const { isLoggedIn } = useAuthStore();
  const { pincode, setPincode } = usePincodeStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingPincode, setIsEditingPincode] = useState(false);
  const [tempPincode, setTempPincode] = useState(pincode);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    setTempPincode(pincode);
  }, [pincode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?q=${encodeURIComponent(searchQuery)}&pincode=${pincode}`);
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
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      // Automatically route to intent result based on voice input
      // Ideally we would POST to /v1/intent/text here, but for simplicity
      // we'll route to the search page. A real implementation might use an intent page.
      router.push(`/products?q=${encodeURIComponent(transcript)}&pincode=${pincode}`);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handlePincodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(tempPincode)) {
      setPincode(tempPincode);
      setIsEditingPincode(false);
    } else {
      alert('Please enter a valid 6-digit pincode');
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-background border-b border-card">
      <div className="container mx-auto px-4 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          
          {/* Logo & Mobile Menu */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button className="lg:hidden p-1 text-cta">
              <Menu size={24} />
            </button>
            <Link href="/" className="font-serif text-2xl lg:text-3xl font-bold text-cta">
              Now<span className="text-primary">Snap</span>
            </Link>
          </div>

          {/* Delivery Location */}
          <div className="hidden md:flex flex-col flex-shrink-0 relative">
            <span className="text-[10px] uppercase font-bold text-subtext tracking-wider">Delivering to</span>
            {isEditingPincode ? (
              <form onSubmit={handlePincodeSubmit} className="flex items-center mt-0.5">
                <input
                  type="text"
                  value={tempPincode}
                  onChange={(e) => setTempPincode(e.target.value)}
                  maxLength={6}
                  className="w-20 text-sm font-medium bg-card px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                  onBlur={() => {
                    // Slight delay to allow submit to fire if clicking enter
                    setTimeout(() => setIsEditingPincode(false), 100);
                  }}
                />
              </form>
            ) : (
              <button 
                onClick={() => setIsEditingPincode(true)}
                className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
              >
                <MapPin size={14} className="text-primary" />
                {pincode || 'Select Pincode'}
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl hidden sm:block">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-subtext" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-12 py-2.5 bg-white border border-card rounded-full text-sm placeholder-subtext focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                placeholder="What are you looking for?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="button"
                onClick={handleVoiceSearch}
                className={`absolute inset-y-0 right-1 px-3 flex items-center ${isListening ? 'text-red-500 animate-pulse' : 'text-subtext hover:text-primary'} transition-colors`}
                aria-label="Voice search"
              >
                <Mic size={18} />
              </button>
            </form>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {isLoggedIn ? (
              <Link href="/profile" className="hidden sm:flex items-center gap-2 p-2 hover:bg-card rounded-full transition-colors">
                <User size={20} className="text-cta" />
              </Link>
            ) : (
              <Link href="/login" className="hidden sm:block text-sm font-bold text-cta hover:text-primary transition-colors px-2">
                Sign In
              </Link>
            )}
            
            <button 
              onClick={() => toggleDrawer(true)}
              className="relative p-2 flex items-center gap-2 bg-cta text-background rounded-full hover:bg-opacity-90 transition-all px-3 sm:px-4"
            >
              <ShoppingBag size={20} />
              <span className="text-sm font-bold hidden sm:block">Cart</span>
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-cta text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-background">
                  {totalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
