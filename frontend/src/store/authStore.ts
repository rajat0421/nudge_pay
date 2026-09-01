import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api } from "@/lib/api-client";
import type { User } from "@/types/user";

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  organizationName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

interface BackendUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface BackendOrganization {
  id: string;
  name: string;
  timezone: string;
  currency: string;
}

interface AuthResponse {
  user: BackendUser;
  organization: BackendOrganization;
  tokens: { accessToken: string; refreshToken: string };
}

function toFrontendUser(backendUser: BackendUser, organization: BackendOrganization): User {
  const name = `${backendUser.firstName} ${backendUser.lastName}`.trim() || backendUser.email;
  return {
    id: backendUser.id,
    name,
    email: backendUser.email,
    organization: organization.name,
    plan: "trialing",
    timezone: organization.timezone,
    senderName: name,
    senderEmail: backendUser.email,
  };
}

interface AuthState {
  user: User | null;
  organizationId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True once the persisted session has been read back from storage on the client. */
  isHydrated: boolean;
  register: (input: RegisterInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organizationId: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: false,

      register: async (input) => {
        const data = await api.post<AuthResponse>("/auth/register", input, { auth: false });
        set({
          user: toFrontendUser(data.user, data.organization),
          organizationId: data.organization.id,
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
        });
      },

      login: async (input) => {
        const data = await api.post<AuthResponse>("/auth/login", input, { auth: false });
        set({
          user: toFrontendUser(data.user, data.organization),
          organizationId: data.organization.id,
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
        });
      },

      logout: () => {
        const refreshToken = get().refreshToken;
        set({ user: null, organizationId: null, accessToken: null, refreshToken: null });
        if (refreshToken) {
          // Best-effort — local state is already cleared regardless of outcome.
          void api.post("/auth/logout", { refreshToken }, { auth: false }).catch(() => undefined);
        }
      },

      updateUser: (patch) =>
        set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user })),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
    }),
    {
      name: "nudgepay-auth",
      // This module loads during TanStack Start's server-side render, where
      // `localStorage` doesn't exist — a bare reference throws there, which
      // (per zustand's persist implementation) makes it skip assigning
      // `.persist` on the store entirely. Falling back to a no-op storage on
      // the server keeps `.persist` always defined; skipHydration below
      // means the no-op is never actually read from on the server anyway.
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
          : localStorage,
      ),
      // Hydration is triggered manually, client-side only, from __root.tsx.
      skipHydration: true,
      partialize: (state) => ({
        user: state.user,
        organizationId: state.organizationId,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
