import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import type { CreateClientInput, ListClientsQuery, UpdateClientInput } from "./clients.schemas";

function searchFilter(organizationId: string, search?: string): Prisma.ClientWhereInput {
  if (!search) return { organizationId };
  return {
    organizationId,
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ],
  };
}

export function listClients(
  organizationId: string,
  query: ListClientsQuery & { skip: number; take: number },
) {
  return prisma.client.findMany({
    where: searchFilter(organizationId, query.search),
    orderBy: { [query.sortBy]: query.sortOrder },
    skip: query.skip,
    take: query.take,
  });
}

export function countClients(organizationId: string, search?: string) {
  return prisma.client.count({ where: searchFilter(organizationId, search) });
}

export function createClient(organizationId: string, data: CreateClientInput) {
  return prisma.client.create({ data: { ...data, organizationId } });
}

/** Always scoped by organizationId — a client from another org resolves to null, never leaking existence. */
export function findClientById(organizationId: string, id: string) {
  return prisma.client.findFirst({ where: { id, organizationId } });
}

export function updateClient(organizationId: string, id: string, data: UpdateClientInput) {
  return prisma.client.updateMany({ where: { id, organizationId }, data });
}

export function deleteClient(organizationId: string, id: string) {
  return prisma.client.deleteMany({ where: { id, organizationId } });
}

export function countInvoicesForClient(organizationId: string, clientId: string) {
  return prisma.invoice.count({ where: { organizationId, clientId } });
}
