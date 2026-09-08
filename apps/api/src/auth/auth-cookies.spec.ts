import type { FastifyReply, FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthCookies,
  readAccessCookie,
  readRefreshCookie,
  setAuthCookies,
} from "./auth-cookies";

describe("auth cookies", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_ACCESS_SECRET", "access-secret");
    vi.stubEnv("JWT_REFRESH_SECRET", "refresh-secret");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("sets HttpOnly strict cookies without exposing tokens in the response body", () => {
    const header = vi.fn();
    const reply = { header } as unknown as FastifyReply;

    setAuthCookies(reply, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    const cookies = header.mock.calls[0][1] as string[];

    expect(cookies).toEqual([
      expect.stringMatching(
        /^loomkeep_access=[^;]+; Path=\/api; Max-Age=900; HttpOnly; SameSite=Strict/,
      ),
      expect.stringMatching(
        /^loomkeep_refresh=[^;]+; Path=\/api\/auth; Max-Age=2592000; HttpOnly; SameSite=Strict/,
      ),
    ]);
    expect(cookies.join(";")).not.toContain("access-token");
    expect(cookies.join(";")).not.toContain("refresh-token");

    const request = {
      headers: {
        cookie: cookies.map((cookie) => cookie.split(";", 1)[0]).join("; "),
      },
    } as unknown as FastifyRequest;
    expect(readAccessCookie(request)).toBe("access-token");
    expect(readRefreshCookie(request)).toBe("refresh-token");
  });

  it("rejects unencrypted or tampered cookie values", () => {
    const request = {
      headers: {
        cookie: "other=value; loomkeep_access=access; loomkeep_refresh=refresh",
      },
    } as unknown as FastifyRequest;

    expect(readAccessCookie(request)).toBeNull();
    expect(readRefreshCookie(request)).toBeNull();
  });

  it("expires both cookies on logout", () => {
    const reply = { header: vi.fn() } as unknown as FastifyReply;

    clearAuthCookies(reply);

    expect(reply.header).toHaveBeenCalledWith("Set-Cookie", [
      expect.stringContaining("loomkeep_access=; Path=/api; Max-Age=0"),
      expect.stringContaining("loomkeep_refresh=; Path=/api/auth; Max-Age=0"),
    ]);
  });
});
