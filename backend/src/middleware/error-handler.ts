import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
import { fail } from "../utils/response";
import { isProduction } from "../config/env";

function zodToDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(function errorHandler(
    error: FastifyError | Error,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    // Known, intentional application errors — safe to return as-is.
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, code: error.code }, "application error");
      }
      return reply.status(error.statusCode).send(fail(error.code, error.message, error.details));
    }

    if (error instanceof ZodError) {
      return reply
        .status(422)
        .send(fail("VALIDATION_ERROR", "Validation failed", zodToDetails(error)));
    }

    // Fastify's own schema-validation errors (route-level `schema` option).
    if ("validation" in error && error.validation) {
      return reply
        .status(422)
        .send(fail("VALIDATION_ERROR", error.message, error.validation));
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send(fail("CONFLICT", "A record with these values already exists"));
      }
      if (error.code === "P2025") {
        return reply.status(404).send(fail("NOT_FOUND", "Resource not found"));
      }
      if (error.code === "P2003") {
        return reply
          .status(409)
          .send(fail("CONFLICT", "This action conflicts with a related record"));
      }
    }

    const statusCode = "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;

    request.log.error({ err: error }, "unhandled error");

    // Never leak stack traces or internal error messages in production.
    const message =
      !isProduction && statusCode >= 500 ? error.message : "An unexpected error occurred";

    return reply.status(statusCode >= 500 ? 500 : statusCode).send(fail("INTERNAL_ERROR", message));
  });

  app.setNotFoundHandler(function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
    return reply
      .status(404)
      .send(fail("NOT_FOUND", `Route ${request.method} ${request.url} not found`));
  });
}
