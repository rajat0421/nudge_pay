import { create } from "zustand";
import type { User } from "@/types/user";

interface AuthState {
  user: User | null;
  signIn: (email: string) => void;
  signOut: () => void;
  updateUser: (patch: Partial<User>) => void;
}

function deriveNameFromEmail(email: string): string {
  const handle = email.split("@")[0] ?? "";
  if (!handle) return "New user";
  return handle
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  signIn: (email) => {
    const name = deriveNameFromEmail(email);
    set({
      user: {
        id: `usr_${Date.now()}`,
        name,
        email,
        organization: "My Organization",
        plan: "trialing",
        timezone: "UTC",
        senderName: name,
        senderEmail: email,
      },
    });
  },
  signOut: () => set({ user: null }),
  updateUser: (patch) =>
    set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user })),
}));
