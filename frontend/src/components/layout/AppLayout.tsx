import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for the persisted session to load before deciding nobody's signed
    // in — otherwise every full-page refresh would flash-redirect to /login
    // before localStorage has actually been read back.
    if (isHydrated && !user) {
      navigate({ to: "/login" });
    }
  }, [isHydrated, user, navigate]);

  if (!isHydrated || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64">
        <Header title={title} />
        <main>{children}</main>
      </div>
    </div>
  );
}
