import { ErrorCode } from "@loomkeep/shared/catalog";
import type { UserDto } from "@loomkeep/shared/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../auth/auth.svelte";
import { request, tryRefresh } from "./core";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

describe("request() on a 401", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("refreshes an expired access token and sends the request again", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(401, { code: ErrorCode.AuthInvalidAccessToken, message: "x" }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetch);

    await expect(request("/users/me")).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/\/users\/me$/),
      expect.stringMatching(/\/auth\/refresh$/),
      expect.stringMatching(/\/users\/me$/),
    ]);
  });

  // A typo in the current password used to be sent twice: once, then again
  // after a pointless refresh, eating two of the five tries a minute.
  it("sends a wrong current password once, without refreshing", async () => {
    const fetch = vi.fn().mockResolvedValue(
      json(401, {
        code: ErrorCode.AuthCurrentPasswordIncorrect,
        message: "x",
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      request("/users/me/password", { method: "PATCH", body: {} }),
    ).rejects.toMatchObject({ code: ErrorCode.AuthCurrentPasswordIncorrect });
    expect(fetch).toHaveBeenCalledOnce();
  });
});

// A deploy's 502, a 429 or a dropped connection used to sign people out of
// a session that was still valid (audit 2026-11-14, BUG-04).
describe("request() when the refresh fails", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    auth.clear();
  });

  const expiredThenRefresh = (refresh: Response | Error) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(401, { code: ErrorCode.AuthInvalidAccessToken, message: "x" }),
      );
    if (refresh instanceof Error) fetch.mockRejectedValueOnce(refresh);
    else fetch.mockResolvedValueOnce(refresh);
    vi.stubGlobal("fetch", fetch);
    auth.user = { id: "u1" } as UserDto;
  };

  it("keeps the session when the API can't answer the refresh", async () => {
    expiredThenRefresh(json(502, { message: "Bad Gateway" }));

    await expect(request("/users/me")).rejects.toMatchObject({ status: 502 });
    expect(auth.isLoggedIn).toBe(true);
  });

  it("keeps the session when the refresh is rate-limited or offline", async () => {
    expiredThenRefresh(json(429, { code: ErrorCode.ApiRateLimited }));
    await expect(request("/users/me")).rejects.toMatchObject({ status: 429 });
    expect(auth.isLoggedIn).toBe(true);

    expiredThenRefresh(new TypeError("Failed to fetch"));
    await expect(request("/users/me")).rejects.toMatchObject({
      code: ErrorCode.NetworkOffline,
    });
    expect(auth.isLoggedIn).toBe(true);
  });

  it("signs out once the API says the session is gone", async () => {
    expiredThenRefresh(
      json(401, { code: ErrorCode.AuthInvalidRefreshToken, message: "x" }),
    );

    await expect(request("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(auth.isLoggedIn).toBe(false);
  });
});

describe("tryRefresh() across tabs", () => {
  afterEach(() => vi.unstubAllGlobals());

  // Every tab shares the cookies: when another tab rotated them a moment
  // ago, this tab's own refresh is answered "superseded" — and the session
  // it already shares is fine.
  it("treats a refresh another tab just made as a success", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(401, { code: ErrorCode.AuthInvalidAccessToken, message: "x" }),
      )
      .mockResolvedValueOnce(
        json(409, { code: ErrorCode.AuthRefreshSuperseded, message: "x" }),
      )
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetch);

    await expect(request("/users/me")).resolves.toEqual({ ok: true });
  });

  it("queues the refresh behind the other tabs' with a Web Lock", async () => {
    const locked = vi.fn((_name: string, run: () => Promise<boolean>) => run());
    vi.stubGlobal("navigator", { locks: { request: locked } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(tryRefresh()).resolves.toBe(true);
    expect(locked).toHaveBeenCalledWith(
      "loomkeep-refresh",
      expect.any(Function),
    );
  });
});
