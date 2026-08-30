import type { FastifyReply, FastifyRequest } from "fastify";
import { ok } from "../../utils/response";
import * as clientsService from "./clients.service";
import type {
  ClientIdParams,
  CreateClientInput,
  ListClientsQuery,
  UpdateClientInput,
} from "./clients.schemas";

export async function listClientsHandler(
  request: FastifyRequest<{ Querystring: ListClientsQuery }>,
  reply: FastifyReply,
) {
  const result = await clientsService.listClients(request.authUser!.organizationId, request.query);
  return reply.status(200).send(ok(result));
}

export async function getClientHandler(
  request: FastifyRequest<{ Params: ClientIdParams }>,
  reply: FastifyReply,
) {
  const client = await clientsService.getClient(request.authUser!.organizationId, request.params.id);
  return reply.status(200).send(ok(client));
}

export async function createClientHandler(
  request: FastifyRequest<{ Body: CreateClientInput }>,
  reply: FastifyReply,
) {
  const client = await clientsService.createClient(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.body,
  );
  return reply.status(201).send(ok(client));
}

export async function updateClientHandler(
  request: FastifyRequest<{ Params: ClientIdParams; Body: UpdateClientInput }>,
  reply: FastifyReply,
) {
  const client = await clientsService.updateClient(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.params.id,
    request.body,
  );
  return reply.status(200).send(ok(client));
}

export async function deleteClientHandler(
  request: FastifyRequest<{ Params: ClientIdParams }>,
  reply: FastifyReply,
) {
  await clientsService.deleteClient(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.params.id,
  );
  return reply.status(204).send();
}
