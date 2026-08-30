import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app";

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

interface RegisterOverrides {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
}

let counter = 0;

export async function registerTestUser(app: FastifyInstance, overrides: RegisterOverrides = {}) {
  counter += 1;
  const payload = {
    email: overrides.email ?? `user${counter}@example.com`,
    password: overrides.password ?? "password123",
    firstName: overrides.firstName ?? "Test",
    lastName: overrides.lastName ?? "User",
    organizationName: overrides.organizationName ?? `Test Org ${counter}`,
  };

  const response = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });
  const body = response.json();
  return { response, body, payload };
}

export function authHeader(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}
