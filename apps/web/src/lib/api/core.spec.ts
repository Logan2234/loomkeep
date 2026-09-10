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

// Each case calls loadRequest(), which resets the module registry and
// re-imports ./core — pulling the whole $env/paraglide graph through the
// SvelteKit transform again. That costs seconds when the rest of the suite
// is competing for workers, and the 5s default made this block fail
// intermittently depending on scheduling, not on anything it asserts.
describe("request() → GlitchTip reporting", { timeout: 20_000 }, () => {
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

  it("sends the selected locale to initialize a new account consistently", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    const request = await loadRequest(undefined);
    const runtime = await import("../paraglide/runtime.js");
    const original = runtime.getLocale;
    runtime.overwriteGetLocale(() => "fr");

    try {
      await request("/auth/register", {
        method: "POST",
        body: {},
        withAuth: false,
      });
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ "Accept-Language": "fr" }),
        }),
      );
    } finally {
      runtime.overwriteGetLocale(original);
    }
  });
});

// fetchAllPages() drains a paginated endpoint until `hasMore` goes false. Both
// guards below exist because that condition is the server's word, not a fact.
describe("fetchAllPages() → runaway guards", { timeout: 20_000 }, () => {
  async function loadFetchAllPages() {
    vi.resetModules();
    vi.doMock("$env/dynamic/public", () => ({ env: {} }));
    const { fetchAllPages } = await import("./core");
    return fetchAllPages;
  }

  it("stops on an empty page even when the server still claims more", async () => {
    const fetchAllPages = await loadFetchAllPages();
    const fetchPage = vi.fn().mockResolvedValue({ items: [], hasMore: true });

    const items = await fetchAllPages(fetchPage);

    expect(items).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("caps the number of pages and returns what it collected", async () => {
    const fetchAllPages = await loadFetchAllPages();
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ items: ["x"], hasMore: true });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const items = await fetchAllPages(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(1000);
    expect(items).toHaveLength(1000);
    expect(console.warn).toHaveBeenCalled();
  });
});
