import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../auth.svelte";
import { initAuth } from "./auth";
import { ApiError } from "./core";

// initAuth() has to tell "there is no session" apart from "the API didn't
// answer". Clearing on both logged people out of the PWA whenever a mobile
// connection dropped, since /app bounces to /login on an empty session.
//
// The transport is mocked once, hoisted, rather than per-case with
// resetModules: re-importing ./auth pulls the whole $env/paraglide graph
// through the SvelteKit transform again, which made this file flaky under a
// loaded worker pool (see the same note in core.spec.ts).
const { typedRequest } = vi.hoisted(() => ({ typedRequest: vi.fn() }));
vi.mock("./generated/typed-request", () => ({ typedRequest }));

describe("initAuth() session restore", () => {
  beforeEach(() => {
    typedRequest.mockReset();
    auth.user = { username: "qa" } as never;
  });

  it("keeps the session when the API is unreachable", async () => {
    typedRequest.mockRejectedValue(new ApiError(0, "Network request failed"));

    expect(await initAuth()).toBe(false);
    expect(auth.user).not.toBeNull();
  });

  it("keeps the session on a 5xx", async () => {
    typedRequest.mockRejectedValue(new ApiError(503, "Unavailable"));

    expect(await initAuth()).toBe(false);
    expect(auth.user).not.toBeNull();
  });

  it("clears the session when the API rejects the credentials", async () => {
    typedRequest.mockRejectedValue(new ApiError(401, "Unauthorized"));

    expect(await initAuth()).toBe(true);
    expect(auth.user).toBeNull();
  });
});
