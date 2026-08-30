import { Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/automations", label: "Automations", icon: Workflow },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  const plan = useAuthStore((s) => s.user?.plan);

  return (
    <>
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
              R
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">{APP_NAME}</span>
          </Link>
          <button
            className="text-sidebar-foreground/70 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className: "bg-sidebar-accent text-sidebar-accent-foreground",
              }}
            >
              <Icon className="size-4.5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="rounded-xl border border-sidebar-border p-3.5">
          <p className="text-xs font-medium text-sidebar-primary capitalize">
            {plan ?? "Trial"} plan
          </p>
          <p className="mt-1 text-xs text-sidebar-foreground/60">
            Unlimited reminders while you validate with pilot clients.
          </p>
          <Link
            to="/settings"
            className="mt-3 inline-flex text-xs font-semibold text-sidebar-foreground underline decoration-sidebar-primary decoration-2 underline-offset-4"
          >
            Manage plan
          </Link>
        </div>
      </aside>
    </>
  );
}
