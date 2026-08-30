import type { FastifyReply, FastifyRequest } from "fastify";
import { ok } from "../../utils/response";
import * as invoicesService from "./invoices.service";
import type {
  CreateInvoiceInput,
  InvoiceIdParams,
  ListInvoicesQuery,
  UpdateInvoiceInput,
} from "./invoices.schemas";

export async function listInvoicesHandler(
  request: FastifyRequest<{ Querystring: ListInvoicesQuery }>,
  reply: FastifyReply,
) {
  const result = await invoicesService.listInvoices(request.authUser!.organizationId, request.query);
  return reply.status(200).send(ok(result));
}

export async function getInvoiceHandler(
  request: FastifyRequest<{ Params: InvoiceIdParams }>,
  reply: FastifyReply,
) {
  const invoice = await invoicesService.getInvoice(
    request.authUser!.organizationId,
    request.params.id,
  );
  return reply.status(200).send(ok(invoice));
}

export async function createInvoiceHandler(
  request: FastifyRequest<{ Body: CreateInvoiceInput }>,
  reply: FastifyReply,
) {
  const invoice = await invoicesService.createInvoice(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.body,
  );
  return reply.status(201).send(ok(invoice));
}

export async function updateInvoiceHandler(
  request: FastifyRequest<{ Params: InvoiceIdParams; Body: UpdateInvoiceInput }>,
  reply: FastifyReply,
) {
  const invoice = await invoicesService.updateInvoice(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.params.id,
    request.body,
  );
  return reply.status(200).send(ok(invoice));
}

export async function deleteInvoiceHandler(
  request: FastifyRequest<{ Params: InvoiceIdParams }>,
  reply: FastifyReply,
) {
  await invoicesService.deleteInvoice(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.params.id,
  );
  return reply.status(204).send();
}

export async function markPaidHandler(
  request: FastifyRequest<{ Params: InvoiceIdParams }>,
  reply: FastifyReply,
) {
  const invoice = await invoicesService.markPaid(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.params.id,
  );
  return reply.status(200).send(ok(invoice));
}

export async function pauseRemindersHandler(
  request: FastifyRequest<{ Params: InvoiceIdParams }>,
  reply: FastifyReply,
) {
  const invoice = await invoicesService.pauseReminders(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.params.id,
  );
  return reply.status(200).send(ok(invoice));
}

export async function resumeRemindersHandler(
  request: FastifyRequest<{ Params: InvoiceIdParams }>,
  reply: FastifyReply,
) {
  const invoice = await invoicesService.resumeReminders(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.params.id,
  );
  return reply.status(200).send(ok(invoice));
}
