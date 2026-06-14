import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  userId: string | null;
  isLoggedIn: boolean;
  setToken: (token: string, userId?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      isLoggedIn: false,
      setToken: (token, userId = 'test_user_regular') => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('snap_token', token);
        }
        set({ token, userId, isLoggedIn: true });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('snap_token');
        }
        set({ token: null, userId: null, isLoggedIn: false });
      },
    }),
    {
      name: 'snap_auth',
    }
  )
);
