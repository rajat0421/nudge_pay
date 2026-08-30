import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  if (!user) return null;

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
