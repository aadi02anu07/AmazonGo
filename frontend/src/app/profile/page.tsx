'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { usePincodeStore } from '@/store/usePincodeStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { User, MapPin, Bell, LogOut, Package, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const { logout, userId } = useAuthStore();
  const { pincode, setPincode } = usePincodeStore();
  
  const [isEditingPincode, setIsEditingPincode] = useState(false);
  const [tempPincode, setTempPincode] = useState(pincode);
  const [notifications, setNotifications] = useState(true);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handlePincodeSave = () => {
    if (/^\d{6}$/.test(tempPincode)) {
      setPincode(tempPincode);
      setIsEditingPincode(false);
    } else {
      alert('Please enter a valid 6-digit pincode');
    }
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 lg:px-8 py-10 max-w-4xl pb-20">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-cta mb-8">My Account</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            {/* User Info */}
            <div className="bg-white border border-card rounded-3xl p-6 md:p-8 flex items-center gap-6 shadow-sm">
              <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center flex-shrink-0">
                <User size={32} className="text-cta" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-cta mb-1">Jane Doe</h2>
                <p className="text-subtext">jane.doe@example.com</p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-primary/20 text-cta text-xs font-bold uppercase tracking-widest rounded-full">
                  <Sparkles size={12} className="text-primary" /> Platinum Tier
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="bg-white border border-card rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 md:p-8 border-b border-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center text-cta">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-cta text-lg">Default Pincode</h3>
                    <p className="text-sm text-subtext">For quick delivery estimates</p>
                  </div>
                </div>
                {isEditingPincode ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={tempPincode}
                      onChange={(e) => setTempPincode(e.target.value)}
                      maxLength={6}
                      className="w-24 bg-card px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-primary text-cta font-medium"
                    />
                    <button onClick={handlePincodeSave} className="bg-cta text-white px-4 py-2 rounded font-bold hover:bg-opacity-90">Save</button>
                    <button onClick={() => setIsEditingPincode(false)} className="px-3 py-2 text-subtext hover:text-cta font-medium">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-lg text-cta">{pincode || 'Not Set'}</span>
                    <button onClick={() => setIsEditingPincode(true)} className="text-sm font-bold text-primary hover:text-cta transition-colors">Edit</button>
                  </div>
                )}
              </div>

              <div className="p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center text-cta">
                    <Bell size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-cta text-lg">Order Notifications</h3>
                    <p className="text-sm text-subtext">Receive updates about your delivery</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={notifications} onChange={() => setNotifications(!notifications)} />
                  <div className="w-14 h-7 bg-card rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-subtext peer-checked:after:bg-white after:border after:border-card after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Link href="/orders" className="bg-card rounded-3xl p-6 flex items-center gap-4 hover:shadow-md transition-shadow group border border-primary/10">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-cta group-hover:bg-primary transition-colors">
                <Package size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-cta text-lg">My Orders</h3>
                <p className="text-sm text-subtext">View history & reorder</p>
              </div>
            </Link>

            <button onClick={handleLogout} className="w-full bg-white border-2 border-card rounded-3xl p-6 flex items-center gap-4 hover:bg-card transition-colors text-left group">
              <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center text-cta group-hover:bg-white group-hover:text-red-500 transition-colors">
                <LogOut size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-cta text-lg group-hover:text-red-600 transition-colors">Sign Out</h3>
              </div>
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
