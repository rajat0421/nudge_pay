import type { FastifyReply, FastifyRequest } from "fastify";
import { ok } from "../../utils/response";
import { UnauthorizedError } from "../../utils/errors";
import * as authService from "./auth.service";
import type { LoginInput, LogoutInput, RefreshInput, RegisterInput } from "./auth.schemas";

export async function registerHandler(
  request: FastifyRequest<{ Body: RegisterInput }>,
  reply: FastifyReply,
) {
  const result = await authService.register(request.body);
  return reply.status(201).send(ok(result));
}

export async function loginHandler(
  request: FastifyRequest<{ Body: LoginInput }>,
  reply: FastifyReply,
) {
  const result = await authService.login(request.body);
  return reply.status(200).send(ok(result));
}

export async function refreshHandler(
  request: FastifyRequest<{ Body: RefreshInput }>,
  reply: FastifyReply,
) {
  const tokens = await authService.refresh(request.body.refreshToken);
  return reply.status(200).send(ok(tokens));
}

export async function logoutHandler(
  request: FastifyRequest<{ Body: LogoutInput }>,
  reply: FastifyReply,
) {
  await authService.logout(request.body.refreshToken);
  return reply.status(204).send();
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authUser) {
    throw new UnauthorizedError();
  }
  const result = await authService.me(request.authUser.userId);
  return reply.status(200).send(ok(result));
}
