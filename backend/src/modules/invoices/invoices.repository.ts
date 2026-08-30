import type { Prisma, InvoiceStatus } from "@prisma/client";
import { prisma } from "../../db/prisma";

function searchFilter(
  organizationId: string,
  opts: { status?: InvoiceStatus; clientId?: string; search?: string },
): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { organizationId };
  if (opts.status) where.status = opts.status;
  if (opts.clientId) where.clientId = opts.clientId;
  if (opts.search) {
    where.OR = [
      { invoiceNumber: { contains: opts.search, mode: "insensitive" } },
      { client: { name: { contains: opts.search, mode: "insensitive" } } },
      { client: { companyName: { contains: opts.search, mode: "insensitive" } } },
    ];
  }
  return where;
}

type InvoiceSortField = "dueDate" | "createdAt" | "amount" | "invoiceNumber";

export function listInvoices(
  organizationId: string,
  opts: {
    status?: InvoiceStatus;
    clientId?: string;
    search?: string;
    sortBy: InvoiceSortField;
    sortOrder: "asc" | "desc";
    skip: number;
    take: number;
  },
) {
  return prisma.invoice.findMany({
    where: searchFilter(organizationId, opts),
    orderBy: { [opts.sortBy]: opts.sortOrder },
    include: { client: true },
    skip: opts.skip,
    take: opts.take,
  });
}

export function countInvoices(
  organizationId: string,
  opts: { status?: InvoiceStatus; clientId?: string; search?: string },
) {
  return prisma.invoice.count({ where: searchFilter(organizationId, opts) });
}

export function findInvoiceById(organizationId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, organizationId },
    include: { client: true, reminderSequence: { include: { steps: true } }, reminderEvents: true },
  });
}

export interface CreateInvoiceData {
  clientId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  paymentUrl: string | null;
  reminderSequenceId: string | null;
  status: InvoiceStatus;
}

export function createInvoice(organizationId: string, data: CreateInvoiceData) {
  return prisma.invoice.create({ data: { ...data, organizationId }, include: { client: true } });
}

/**
 * `data` may contain nested relation writes (`client: { connect }`,
 * `reminderSequence: { connect/disconnect }`), which Prisma's `updateMany`
 * does not support — only a single-record `update` does. Tenant scoping is
 * still enforced here (not just by the caller) via the ownership check
 * before the write.
 */
export async function updateInvoice(
  organizationId: string,
  id: string,
  data: Prisma.InvoiceUpdateInput,
): Promise<{ count: number }> {
  const owned = await prisma.invoice.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!owned) return { count: 0 };
  await prisma.invoice.update({ where: { id }, data });
  return { count: 1 };
}

export function deleteInvoice(organizationId: string, id: string) {
  return prisma.invoice.deleteMany({ where: { id, organizationId } });
}

export function findClientForOrg(organizationId: string, clientId: string) {
  return prisma.client.findFirst({ where: { id: clientId, organizationId } });
}
