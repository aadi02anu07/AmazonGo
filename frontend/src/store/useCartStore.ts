import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  name: string;
  price: number; // in paise (e.g. 2000 = ₹20)
  image: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, quantity: number) => void;
  clearCart: () => void;
  toggleDrawer: (open?: boolean) => void;
  totalCount: number;
  totalPrice: number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,
      addItem: (newItem) => {
        set((state) => {
          const existingItem = state.items.find((i) => i.id === newItem.id);
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.id === newItem.id ? { ...i, quantity: i.quantity + (newItem.quantity || 1) } : i
              ),
            };
          }
          return {
            items: [...state.items, { ...newItem, quantity: newItem.quantity || 1 }],
          };
        });
      },
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),
      updateQty: (id, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((i) => i.id !== id) };
          }
          return {
            items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
          };
        }),
      clearCart: () => set({ items: [] }),
      toggleDrawer: (open) =>
        set((state) => ({
          isDrawerOpen: open !== undefined ? open : !state.isDrawerOpen,
        })),
      get totalCount() {
        return get().items.reduce((acc, item) => acc + item.quantity, 0);
      },
      get totalPrice() {
        return get().items.reduce((acc, item) => acc + item.price * item.quantity, 0);
      },
    }),
    {
      name: 'snap_cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
);
