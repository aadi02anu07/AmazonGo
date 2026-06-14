'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setToken } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const redirectUrl = searchParams.get('redirect') || '/';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Local dev: use a pre-built JWT with sub = test_user_regular (35 orders, tier 3)
    // This JWT has payload: { "sub": "test_user_regular" }
    // Serverless Offline doesn't verify the signature — it just parses the sub claim
    const localDevToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXJfcmVndWxhciIsImVtYWlsIjoidGVzdF9yZWd1bGFyQHNuYXAuZGV2IiwiaWF0IjoxNzA0MDY3MjAwfQ.fake_signature';
    
    setTimeout(() => {
      setToken(localDevToken, 'test_user_regular');
      localStorage.setItem('snap_token', localDevToken);
      router.push(redirectUrl);
    }, 1000);
  };

  return (
    <div className="container mx-auto px-4 py-20 flex justify-center">
      <div className="w-full max-w-md bg-white border border-card rounded-3xl p-8 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-cta mb-2">Welcome Back</h1>
          <p className="text-subtext">Sign in to your Amazon Now Snap account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-subtext mb-2">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-card px-4 py-3 rounded-xl border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary text-cta"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-subtext mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-card px-4 py-3 rounded-xl border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary text-cta"
              placeholder="••••••••"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full py-3 bg-cta text-white rounded-full font-bold text-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-subtext">
          Don't have an account?{' '}
          <Link href="/signup" className="font-bold text-cta hover:text-primary transition-colors">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
