import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();

vi.mock("@sentry/sveltekit", () => ({ captureException }));

async function loadRequest(dsn: string | undefined) {
  vi.resetModules();
  vi.doMock("$env/dynamic/public", () => ({
    env: { PUBLIC_GLITCHTIP_WEB_DSN: dsn },
  }));
  const { request } = await import("./core");
  return request;
}

describe("request() → GlitchTip reporting", () => {
  beforeEach(() => {
    captureException.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("$env/dynamic/public");
  });

  it("reports a 5xx with the requestId tag when a DSN is configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ message: "boom", requestId: "req-1" }),
            { status: 500 },
          ),
        ),
    );
    const request = await loadRequest("https://glitchtip.example/1");

    await expect(request("/x")).rejects.toThrow();

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(expect.anything(), {
      tags: { requestId: "req-1" },
    });
  });

  it("does not report a 403 — an expected outcome, not an incident", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "forbidden" }), {
          status: 403,
        }),
      ),
    );
    const request = await loadRequest("https://glitchtip.example/1");

    await expect(request("/x")).rejects.toThrow();

    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not report a 5xx when no DSN is configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: "boom" }), { status: 500 }),
        ),
    );
    const request = await loadRequest(undefined);

    await expect(request("/x")).rejects.toThrow();

    expect(captureException).not.toHaveBeenCalled();
  });

  it("reports a network failure (fetch rejects) with no requestId", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const request = await loadRequest("https://glitchtip.example/1");

    await expect(request("/x")).rejects.toThrow();

    expect(captureException).toHaveBeenCalledWith(expect.anything(), {
      tags: { requestId: undefined },
    });
  });
});
