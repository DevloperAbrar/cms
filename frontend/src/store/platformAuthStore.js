import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const usePlatformAuthStore = create(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      logout: () => {
        localStorage.removeItem('platform_token');
        set({ token: null, isAuthenticated: false });
      },
    }),
    { name: 'platform-auth' }
  )
);

export default usePlatformAuthStore;