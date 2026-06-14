import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PincodeState {
  pincode: string;
  setPincode: (pincode: string) => void;
}

export const usePincodeStore = create<PincodeState>()(
  persist(
    (set) => ({
      pincode: '',
      setPincode: (pincode) => set({ pincode }),
    }),
    {
      name: 'snap_pincode',
    }
  )
);
