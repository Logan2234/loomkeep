import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { vi } from "vitest";
import { AppException } from "../common/app.exception";
import { setAuthCookies } from "./auth-cookies";
import { AuthController } from "./auth.controller";
import type { AuthService } from "./auth.service";

// Auth cookies are encrypted with a key derived from the JWT secrets, so the
// helpers refuse to run without them — set before the module does any work.
process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

const TOKENS = { accessToken: "access", refreshToken: "refresh" };
const USER = { id: "u1", email: "alice@example.com" } as never;

/**
 * The controller's own job is the cookie envelope: the service returns tokens,
 * and whether they end up as `Set-Cookie` — or are wiped — is decided here.
 * A fake reply records the headers so that decision is observable.
 */
function fakeReply() {
  const headers: Record<string, unknown> = {};
  const reply = {
    header: vi.fn((name: string, value: unknown) => {
      headers[name] = value;
      return reply;
    }),
  } as unknown as FastifyReply & { header: ReturnType<typeof vi.fn> };
  return { reply, headers };
}

function request(cookie?: string): FastifyRequest {
  return { headers: cookie ? { cookie } : {} } as unknown as FastifyRequest;
}

/**
 * A request carrying a genuinely encrypted refresh cookie, produced by the
 * same helper the controller writes with — a hand-written value would only
 * ever exercise the decryption failure path.
 */
function requestWithRefresh(token: string): FastifyRequest {
  const { reply, headers } = fakeReply();
  setAuthCookies(reply, { accessToken: "unused", refreshToken: token });
  const refresh = setCookies(headers).find((c) =>
    c.startsWith("loomkeep_refresh="),
  );
  return request(refresh?.split(";", 1)[0]);
}

/** The two cookies `setAuthCookies` writes, as the values a test can assert. */
function setCookies(headers: Record<string, unknown>): string[] {
  const value = headers["Set-Cookie"];
  return Array.isArray(value) ? (value as string[]) : [];
}

function makeController(auth: Partial<AuthService> = {}) {
  return new AuthController(auth as AuthService);
}

describe("AuthController.register", () => {
  it("returns the user and puts the tokens in cookies, never in the body", async () => {
    const { reply, headers } = fakeReply();
    const controller = makeController({
      register: vi.fn().mockResolvedValue({ user: USER, tokens: TOKENS }),
    });

    const body = await controller.register(
      {} as never,
      reply,
      "agent",
      "1.2.3.4",
      "fr",
    );

    expect(body).toEqual({ user: USER });
    expect(JSON.stringify(body)).not.toContain("access");
    expect(setCookies(headers).join("\n")).toContain("access");
  });

  it("passes the request's own context through to the service", async () => {
    // user-agent, IP and accept-language drive session naming and the
    // account's initial locale — dropping one is silent.
    const { reply } = fakeReply();
    const register = vi.fn().mockResolvedValue({ user: USER, tokens: TOKENS });

    await makeController({ register }).register(
      { email: "a@b.c" } as never,
      reply,
      "Firefox",
      "9.9.9.9",
      "en",
    );

    expect(register).toHaveBeenCalledWith(
      { email: "a@b.c" },
      "Firefox",
      "9.9.9.9",
      "en",
    );
  });
});

describe("AuthController.login", () => {
  it("sets the cookies once the login is complete", async () => {
    const { reply, headers } = fakeReply();
    const controller = makeController({
      login: vi
        .fn()
        .mockResolvedValue({ mfaRequired: false, user: USER, tokens: TOKENS }),
    });

    const body = await controller.login(
      {} as never,
      reply,
      undefined,
      undefined,
    );

    expect(body).toEqual({ mfaRequired: false, user: USER });
    expect(setCookies(headers)).toHaveLength(2);
  });

  it("issues no cookie while a second factor is still owed", async () => {
    // The whole point of the challenge: no session exists yet, so nothing may
    // be set that would authenticate the caller.
    const { reply, headers } = fakeReply();
    const challenge = {
      mfaRequired: true,
      challengeId: "c1",
      methods: ["TOTP"],
    };
    const controller = makeController({
      login: vi.fn().mockResolvedValue(challenge),
    });

    const body = await controller.login(
      {} as never,
      reply,
      undefined,
      undefined,
    );

    expect(body).toBe(challenge);
    expect(reply.header).not.toHaveBeenCalled();
  });
});

describe("AuthController.mfaVerify", () => {
  it("sets the cookies only after the code checks out", async () => {
    const { reply, headers } = fakeReply();
    const verifyMfaLogin = vi
      .fn()
      .mockResolvedValue({ user: USER, tokens: TOKENS });

    const body = await makeController({ verifyMfaLogin }).mfaVerify(
      { challengeId: "c1", code: "123456" } as never,
      reply,
      "agent",
      "1.2.3.4",
    );

    expect(verifyMfaLogin).toHaveBeenCalledWith(
      "c1",
      "123456",
      "agent",
      "1.2.3.4",
    );
    expect(body).toEqual({ user: USER });
    expect(setCookies(headers)).toHaveLength(2);
  });
});

describe("AuthController.refresh", () => {
  it("refuses a request carrying no refresh cookie, without asking the service", async () => {
    const { reply } = fakeReply();
    const refresh = vi.fn();

    await expect(
      makeController({ refresh }).refresh(request(), reply),
    ).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
      code: ErrorCode.AuthInvalidRefreshToken,
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reads the token from the cookie and re-issues the pair", async () => {
    const { reply, headers } = fakeReply();
    const refresh = vi.fn().mockResolvedValue(TOKENS);

    await makeController({ refresh }).refresh(
      requestWithRefresh("stored-token"),
      reply,
    );

    expect(refresh).toHaveBeenCalledWith("stored-token");
    expect(setCookies(headers)).toHaveLength(2);
  });

  it("wipes the cookies when the token is rejected", async () => {
    // Otherwise the browser keeps replaying a token the server will never
    // accept, and the client cannot tell a dead session from a flaky one.
    const { reply, headers } = fakeReply();
    const error = new AppException(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.AuthInvalidRefreshToken,
    );
    const controller = makeController({
      refresh: vi.fn().mockRejectedValue(error),
    });

    await expect(
      controller.refresh(requestWithRefresh("stale"), reply),
    ).rejects.toBe(error);
    expect(setCookies(headers).join("\n")).toContain("Max-Age=0");
  });

  it("leaves the session alone when the failure is not an auth one", async () => {
    // A database outage is not a reason to sign someone out.
    const { reply } = fakeReply();
    const boom = new Error("database unreachable");
    const controller = makeController({
      refresh: vi.fn().mockRejectedValue(boom),
    });

    await expect(
      controller.refresh(requestWithRefresh("valid"), reply),
    ).rejects.toBe(boom);
    expect(reply.header).not.toHaveBeenCalled();
  });
});
