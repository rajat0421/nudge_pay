import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, registerTestUser } from "./helpers/app";

describe("auth", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers a new user with a new organization", async () => {
    const { response, body } = await registerTestUser(app, { email: "owner@acme.test" });

    expect(response.statusCode).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe("owner@acme.test");
    expect(body.data.user.passwordHash).toBeUndefined();
    expect(body.data.organization.name).toBeDefined();
    expect(body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(body.data.tokens.refreshToken).toEqual(expect.any(String));
  });

  it("rejects registering the same email twice", async () => {
    await registerTestUser(app, { email: "dupe@acme.test" });
    const { response, body } = await registerTestUser(app, { email: "dupe@acme.test" });

    expect(response.statusCode).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("rejects invalid registration input with 422", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "not-an-email", password: "short", firstName: "", lastName: "", organizationName: "" },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().success).toBe(false);
  });

  it("logs in with correct credentials", async () => {
    const { payload } = await registerTestUser(app, { email: "login@acme.test", password: "correct-horse" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: payload.email, password: payload.password },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.tokens.accessToken).toEqual(expect.any(String));
  });

  it("rejects an invalid password without revealing which field was wrong", async () => {
    const { payload } = await registerTestUser(app, { email: "wrongpass@acme.test" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: payload.email, password: "totally-wrong" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe("Invalid email or password");
  });

  it("rejects login for an unknown email with the same generic message", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nobody@acme.test", password: "whatever123" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe("Invalid email or password");
  });

  it("issues a new token pair on refresh and rotates the refresh token", async () => {
    const { body } = await registerTestUser(app, { email: "refresh@acme.test" });
    const { refreshToken } = body.data.tokens;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(200);
    const newTokens = response.json().data;
    expect(newTokens.refreshToken).not.toBe(refreshToken);
  });

  it("detects refresh token reuse and revokes the session", async () => {
    const { body } = await registerTestUser(app, { email: "reuse@acme.test" });
    const { refreshToken } = body.data.tokens;

    // First use rotates the token successfully.
    await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken } });

    // Reusing the same (now-rotated) token must be rejected.
    const reuseResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken },
    });

    expect(reuseResponse.statusCode).toBe(401);
  });

  it("returns the current user via /me", async () => {
    const { body } = await registerTestUser(app, { email: "me@acme.test" });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${body.data.tokens.accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.user.email).toBe("me@acme.test");
  });

  it("rejects /me without a token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(response.statusCode).toBe(401);
  });
});
