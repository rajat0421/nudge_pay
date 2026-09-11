import { api, type PaginatedResponse } from "@/lib/api";
import type { ActivityItem, DashboardSummary } from "@/types/dashboard";
import type { Invoice } from "@/types/invoice";

export function getDashboardSummary(): Promise<DashboardSummary> {
  return api.get<DashboardSummary>("/dashboard/summary");
}

export function getOverdueInvoices(params: { page?: number; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<PaginatedResponse<Invoice>>(`/dashboard/overdue${qs ? `?${qs}` : ""}`);
}

export function getRecentActivity(params: { page?: number; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<PaginatedResponse<ActivityItem>>(`/dashboard/activity${qs ? `?${qs}` : ""}`);
}
