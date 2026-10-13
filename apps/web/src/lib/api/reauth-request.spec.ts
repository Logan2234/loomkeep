import { ErrorCode } from "@loomkeep/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "../paraglide/messages.js";
import { reauth } from "../reauth.svelte";
import { request } from "./core";

const reauthRequired = () =>
  new Response(
    JSON.stringify({ code: ErrorCode.AuthReauthRequired, message: "x" }),
    { status: 403 },
  );
const created = () =>
  new Response(JSON.stringify({ id: "key-1" }), { status: 201 });
const inTenMinutes = () => new Date(Date.now() + 600_000).toISOString();

describe("request() when an action wants the person to confirm it's them", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks, then sends the same request again", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reauthRequired())
      .mockResolvedValueOnce(created());
    vi.stubGlobal("fetch", fetch);

    const sent = request("/api-keys", { method: "POST", body: { name: "S" } });
    await vi.waitFor(() =>
      expect(reauth.reason).toBe(m.reauth_reason_api_key()),
    );
    reauth.confirmed(inTenMinutes());

    await expect(sent).resolves.toEqual({ id: "key-1" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reauth.reason).toBeNull();
  });

  it("drops the action when the confirmation is closed", async () => {
    const fetch = vi.fn().mockResolvedValue(reauthRequired());
    vi.stubGlobal("fetch", fetch);

    const sent = request("/auth/sessions", { method: "DELETE" });
    await vi.waitFor(() => expect(reauth.reason).not.toBeNull());
    reauth.cancelled();

    await expect(sent).rejects.toMatchObject({
      code: ErrorCode.AuthReauthCancelled,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("asks once for actions that need it at the same time", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reauthRequired())
        .mockResolvedValueOnce(reauthRequired())
        .mockImplementation(() => Promise.resolve(created())),
    );
    const confirm = vi.spyOn(reauth, "confirm");

    const both = Promise.all([
      request("/api-keys", { method: "POST" }),
      request("/users/me/mfa/totp/setup", { method: "POST" }),
    ]);
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    reauth.confirmed(inTenMinutes());

    await expect(both).resolves.toHaveLength(2);
    expect(await confirm.mock.results[0].value).toBe(true);
    expect(confirm.mock.results[0].value).toBe(confirm.mock.results[1].value);
  });
});
