import { ErrorCode } from "@loomkeep/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "./core";

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
