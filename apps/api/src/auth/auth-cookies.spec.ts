import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
  clearAuthCookies,
  readAccessCookie,
  readRefreshCookie,
  setAuthCookies,
} from "./auth-cookies";

describe("auth cookies", () => {
  it("sets HttpOnly strict cookies without exposing tokens in the response body", () => {
    const reply = { header: vi.fn() } as unknown as FastifyReply;

    setAuthCookies(reply, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    expect(reply.header).toHaveBeenCalledWith("Set-Cookie", [
      expect.stringContaining(
        "loomkeep_access=access-token; Path=/api; Max-Age=900; HttpOnly; SameSite=Strict",
      ),
      expect.stringContaining(
        "loomkeep_refresh=refresh-token; Path=/api/auth; Max-Age=2592000; HttpOnly; SameSite=Strict",
      ),
    ]);
  });

  it("reads the access and refresh cookies independently", () => {
    const request = {
      headers: {
        cookie: "other=value; loomkeep_access=access; loomkeep_refresh=refresh",
      },
    } as unknown as FastifyRequest;

    expect(readAccessCookie(request)).toBe("access");
    expect(readRefreshCookie(request)).toBe("refresh");
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
