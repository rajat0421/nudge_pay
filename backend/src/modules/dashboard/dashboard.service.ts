import { minorToMajorUnits } from "../../utils/money";
import { paginate, toSkipTake, type PaginationQuery } from "../../utils/pagination";
import * as dashboardRepository from "./dashboard.repository";

export async function getSummary(organizationId: string) {
  const aggregates = await dashboardRepository.getSummaryAggregates(organizationId);

  return {
    outstandingAmount: minorToMajorUnits(aggregates.outstandingAmount),
    overdueAmount: minorToMajorUnits(aggregates.overdueAmount),
    paidThisMonth: minorToMajorUnits(aggregates.paidThisMonth),
    totalInvoices: aggregates.totalInvoices,
    overdueCount: aggregates.overdueCount,
    upcomingDueInvoices: aggregates.upcoming.map((invoice) => ({
      ...invoice,
      amount: minorToMajorUnits(invoice.amount),
    })),
  };
}

export async function getOverdueInvoices(organizationId: string, query: PaginationQuery) {
  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    dashboardRepository.listOverdueInvoices(organizationId, { skip, take }),
    dashboardRepository.countOverdueInvoices(organizationId),
  ]);
  return paginate(
    items.map((invoice) => ({ ...invoice, amount: minorToMajorUnits(invoice.amount) })),
    total,
    query,
  );
}

export async function getRecentActivity(organizationId: string, query: PaginationQuery) {
  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    dashboardRepository.listRecentActivity(organizationId, { skip, take }),
    dashboardRepository.countRecentActivity(organizationId),
  ]);
  return paginate(items, total, query);
}
