import { prisma } from "../../db/prisma";

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getSummaryAggregates(organizationId: string) {
  const [outstandingAgg, overdueAgg, paidThisMonthAgg, totalInvoices, overdueCount, upcoming] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: { organizationId, status: { in: ["SENT", "DUE", "OVERDUE"] } },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { organizationId, status: "OVERDUE" },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { organizationId, status: "PAID", paidAt: { gte: startOfCurrentMonthUtc() } },
        _sum: { amount: true },
      }),
      prisma.invoice.count({ where: { organizationId } }),
      prisma.invoice.count({ where: { organizationId, status: "OVERDUE" } }),
      prisma.invoice.findMany({
        where: { organizationId, status: { in: ["SENT", "DUE"] } },
        orderBy: { dueDate: "asc" },
        take: 5,
        include: { client: true },
      }),
    ]);

  return {
    outstandingAmount: outstandingAgg._sum.amount ?? 0,
    overdueAmount: overdueAgg._sum.amount ?? 0,
    paidThisMonth: paidThisMonthAgg._sum.amount ?? 0,
    totalInvoices,
    overdueCount,
    upcoming,
  };
}

export function listOverdueInvoices(organizationId: string, opts: { skip: number; take: number }) {
  return prisma.invoice.findMany({
    where: { organizationId, status: "OVERDUE" },
    orderBy: { dueDate: "asc" },
    include: { client: true },
    skip: opts.skip,
    take: opts.take,
  });
}

export function countOverdueInvoices(organizationId: string) {
  return prisma.invoice.count({ where: { organizationId, status: "OVERDUE" } });
}

export function listRecentActivity(organizationId: string, opts: { skip: number; take: number }) {
  return prisma.reminderEvent.findMany({
    where: { organizationId, status: { in: ["SENT", "FAILED"] } },
    orderBy: { updatedAt: "desc" },
    include: { invoice: { include: { client: true } }, reminderStep: true },
    skip: opts.skip,
    take: opts.take,
  });
}

export function countRecentActivity(organizationId: string) {
  return prisma.reminderEvent.count({ where: { organizationId, status: { in: ["SENT", "FAILED"] } } });
}
