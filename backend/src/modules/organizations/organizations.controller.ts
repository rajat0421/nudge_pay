import type { FastifyReply, FastifyRequest } from "fastify";
import { ok } from "../../utils/response";
import * as organizationsService from "./organizations.service";
import type { UpdateOrganizationInput } from "./organizations.schemas";

export async function getMyOrganizationHandler(request: FastifyRequest, reply: FastifyReply) {
  const organization = await organizationsService.getMyOrganization(request.authUser!.organizationId);
  return reply.status(200).send(ok(organization));
}

export async function updateMyOrganizationHandler(
  request: FastifyRequest<{ Body: UpdateOrganizationInput }>,
  reply: FastifyReply,
) {
  const organization = await organizationsService.updateMyOrganization(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.body,
  );
  return reply.status(200).send(ok(organization));
}
