import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api, configurarApi } from '../lib/api.js';

// El token vive en localStorage (aplicación interna de sala NOC; el backend lo vence según JWT_EXPIRES_IN).
export const useAuth = create(
  persist(
    (set) => ({
      token: null,
      user: null,

      async login(email, password) {
        const { data } = await api.login(email, password);
        set({ token: data.token, user: data.user });
      },

      logout: () => set({ token: null, user: null }),

      // Refresca el usuario (rol/turno pueden haber cambiado). Un 401 dispara logout vía configurarApi.
      async verificar() {
        const { data } = await api.me();
        set({ user: data });
      },
    }),
    {
      name: 'noc-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
);

configurarApi({
  token: () => useAuth.getState().token,
  noAutorizado: () => useAuth.getState().logout(),
});
