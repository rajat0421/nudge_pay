import type { FastifyReply, FastifyRequest } from "fastify";
import { ok } from "../../utils/response";
import * as remindersService from "./reminders.service";
import type {
  CreateReminderSequenceInput,
  ReminderSequenceIdParams,
  ReminderStepParams,
  UpdateReminderSequenceInput,
  UpdateReminderStepInput,
} from "./reminders.schemas";

export async function listSequencesHandler(request: FastifyRequest, reply: FastifyReply) {
  const sequences = await remindersService.listSequences(request.authUser!.organizationId);
  return reply.status(200).send(ok(sequences));
}

export async function getSequenceHandler(
  request: FastifyRequest<{ Params: ReminderSequenceIdParams }>,
  reply: FastifyReply,
) {
  const sequence = await remindersService.getSequence(
    request.authUser!.organizationId,
    request.params.id,
  );
  return reply.status(200).send(ok(sequence));
}

export async function createSequenceHandler(
  request: FastifyRequest<{ Body: CreateReminderSequenceInput }>,
  reply: FastifyReply,
) {
  const sequence = await remindersService.createSequence(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.body,
  );
  return reply.status(201).send(ok(sequence));
}

export async function updateSequenceHandler(
  request: FastifyRequest<{ Params: ReminderSequenceIdParams; Body: UpdateReminderSequenceInput }>,
  reply: FastifyReply,
) {
  const sequence = await remindersService.updateSequence(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.params.id,
    request.body,
  );
  return reply.status(200).send(ok(sequence));
}

export async function deleteSequenceHandler(
  request: FastifyRequest<{ Params: ReminderSequenceIdParams }>,
  reply: FastifyReply,
) {
  await remindersService.deleteSequence(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.params.id,
  );
  return reply.status(204).send();
}

export async function updateStepHandler(
  request: FastifyRequest<{ Params: ReminderStepParams; Body: UpdateReminderStepInput }>,
  reply: FastifyReply,
) {
  const step = await remindersService.updateStep(
    request.authUser!.organizationId,
    request.authUser!.userId,
    request.params.id,
    request.params.stepId,
    request.body,
  );
  return reply.status(200).send(ok(step));
}
