import { UnleashClient } from "unleash-proxy-client";
import { describe, expect, it, vi } from "vitest";

describe("liveFlags.start", () => {
  it("starts one Unleash client however many times the reconnect screen retries", async () => {
    // No network: each client's polling start is what gets counted.
    const start = vi
      .spyOn(UnleashClient.prototype, "start")
      .mockResolvedValue(undefined);
    vi.resetModules();
    vi.doMock("$app/env/public", () => ({
      PUBLIC_UNLEASH_FRONTEND_URL: "https://flags.example.test/api/frontend",
      PUBLIC_UNLEASH_FRONTEND_TOKEN: "token",
    }));
    const { liveFlags } = await import("./feature-flags-live.svelte");

    await liveFlags.start();
    await liveFlags.start();
    await liveFlags.start();

    expect(start).toHaveBeenCalledTimes(1);
    vi.doUnmock("$app/env/public");
  });
});
