import type { FastifyReply, FastifyRequest } from "fastify";
import { ok } from "../../utils/response";
import type { PaginationQuery } from "../../utils/pagination";
import * as dashboardService from "./dashboard.service";

export async function getSummaryHandler(request: FastifyRequest, reply: FastifyReply) {
  const summary = await dashboardService.getSummary(request.authUser!.organizationId);
  return reply.status(200).send(ok(summary));
}

export async function getOverdueHandler(
  request: FastifyRequest<{ Querystring: PaginationQuery }>,
  reply: FastifyReply,
) {
  const result = await dashboardService.getOverdueInvoices(
    request.authUser!.organizationId,
    request.query,
  );
  return reply.status(200).send(ok(result));
}

export async function getActivityHandler(
  request: FastifyRequest<{ Querystring: PaginationQuery }>,
  reply: FastifyReply,
) {
  const result = await dashboardService.getRecentActivity(
    request.authUser!.organizationId,
    request.query,
  );
  return reply.status(200).send(ok(result));
}
