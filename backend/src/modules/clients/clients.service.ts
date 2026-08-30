import { ConflictError, NotFoundError } from "../../utils/errors";
import { paginate, toSkipTake, type PaginationQuery } from "../../utils/pagination";
import { recordAuditLog } from "../audit/audit.service";
import * as clientsRepository from "./clients.repository";
import type { CreateClientInput, ListClientsQuery, UpdateClientInput } from "./clients.schemas";

export async function listClients(organizationId: string, query: ListClientsQuery) {
  const { skip, take } = toSkipTake(query as PaginationQuery);
  const [items, total] = await Promise.all([
    clientsRepository.listClients(organizationId, { ...query, skip, take }),
    clientsRepository.countClients(organizationId, query.search),
  ]);
  return paginate(items, total, query);
}

export async function getClient(organizationId: string, id: string) {
  const client = await clientsRepository.findClientById(organizationId, id);
  if (!client) throw new NotFoundError("Client not found");
  return client;
}

export async function createClient(
  organizationId: string,
  userId: string,
  input: CreateClientInput,
) {
  const client = await clientsRepository.createClient(organizationId, input);
  await recordAuditLog({
    organizationId,
    userId,
    action: "client.created",
    entityType: "Client",
    entityId: client.id,
  });
  return client;
}

export async function updateClient(
  organizationId: string,
  userId: string,
  id: string,
  input: UpdateClientInput,
) {
  const { count } = await clientsRepository.updateClient(organizationId, id, input);
  if (count === 0) throw new NotFoundError("Client not found");

  await recordAuditLog({
    organizationId,
    userId,
    action: "client.updated",
    entityType: "Client",
    entityId: id,
    metadata: input,
  });
  return clientsRepository.findClientById(organizationId, id);
}

export async function deleteClient(organizationId: string, userId: string, id: string) {
  const existing = await clientsRepository.findClientById(organizationId, id);
  if (!existing) throw new NotFoundError("Client not found");

  const invoiceCount = await clientsRepository.countInvoicesForClient(organizationId, id);
  if (invoiceCount > 0) {
    throw new ConflictError(
      "This client has invoices attached and cannot be deleted. Remove or reassign their invoices first.",
    );
  }

  await clientsRepository.deleteClient(organizationId, id);
  await recordAuditLog({
    organizationId,
    userId,
    action: "client.deleted",
    entityType: "Client",
    entityId: id,
  });
}
