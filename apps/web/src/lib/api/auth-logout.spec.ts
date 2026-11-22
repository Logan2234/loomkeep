import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../auth.svelte";
import { signOutAndRedirect } from "./auth";

// Signing out has to take this device's push subscription with it: left in
// place, a shared browser kept showing the previous account's notifications
// and the next account couldn't subscribe the same endpoint. Mocked the way
// auth-init.spec.ts does, hoisted, for the same reason.
const { typedRequest, disablePush, calls } = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    typedRequest: vi.fn((path: string) => {
      calls.push(path);
      return Promise.resolve(undefined);
    }),
    disablePush: vi.fn(() => {
      calls.push("disablePush");
      return Promise.resolve();
    }),
  };
});
vi.mock("./generated/typed-request", () => ({ typedRequest }));
vi.mock("../push", () => ({ disablePush }));
vi.mock("$app/navigation", () => ({ goto: vi.fn() }));

describe("signOutAndRedirect()", () => {
  beforeEach(() => {
    calls.length = 0;
    auth.user = { username: "qa" } as never;
  });

  afterEach(() => vi.useRealTimers());

  it("unsubscribes this device from push while the session still works, then signs out", async () => {
    await signOutAndRedirect();

    expect(calls).toEqual(["disablePush", "/auth/logout"]);
    expect(auth.user).toBeNull();
  });

  it("still signs out when unsubscribing fails", async () => {
    disablePush.mockRejectedValueOnce(new Error("offline"));

    await signOutAndRedirect();

    expect(calls).toContain("/auth/logout");
    expect(auth.user).toBeNull();
  });

  it("doesn't wait forever on a push service that never answers", async () => {
    vi.useFakeTimers();
    disablePush.mockReturnValueOnce(new Promise(() => {}));

    const signingOut = signOutAndRedirect();
    await vi.advanceTimersByTimeAsync(5_000);
    await signingOut;

    expect(calls).toContain("/auth/logout");
    expect(auth.user).toBeNull();
  });
});
