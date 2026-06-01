import { create } from "zustand";
import type { AuthUser } from "@/lib/auth";

interface AuthState {
  user: AuthUser | null;
  initialized: boolean;
  forbidden: boolean;
  setUser: (user: AuthUser | null) => void;
  setInitialized: (initialized: boolean) => void;
  setForbidden: (forbidden: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  forbidden: false,
  setUser: (user) => set({ user }),
  setInitialized: (initialized) => set({ initialized }),
  setForbidden: (forbidden) => set({ forbidden }),
}));
