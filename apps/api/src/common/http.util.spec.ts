import { ErrorCode } from "@loomkeep/shared";
import { fetchJson } from "./http.util";

// Node defines global fetch lazily, which confuses jest.spyOn on restore;
// swap the reference directly instead.
const originalFetch = global.fetch;

function jsonResponse(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as Response;
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("fetchJson", () => {
  it("returns the parsed body on success", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));

    const result = await fetchJson(
      "https://example.test",
      {},
      {
        sourceLabel: "Test",
      },
    );

    expect(result).toEqual({ ok: true });
  });

  it("retries a transient 503 and succeeds on the next attempt", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchJson(
      "https://example.test",
      {},
      {
        sourceLabel: "Test",
      },
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting retries on repeated 5xx", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(500));

    await expect(
      fetchJson("https://example.test", {}, { sourceLabel: "Test" }),
    ).rejects.toMatchObject({ code: ErrorCode.CatalogProviderUnavailable });
  });

  it("maps 404 to catalog.item_not_found without retrying, when notFoundMessage is set", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(404));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchJson(
        "https://example.test",
        {},
        {
          sourceLabel: "Test",
          notFoundMessage: "not found",
        },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.CatalogItemNotFound });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-transient 400", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(400));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchJson("https://example.test", {}, { sourceLabel: "Test" }),
    ).rejects.toMatchObject({ code: ErrorCode.CatalogProviderUnavailable });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up immediately when a 429's Retry-After exceeds maxRetryDelayMs", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "60" }),
      json: () => Promise.resolve({}),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchJson(
        "https://example.test",
        {},
        { sourceLabel: "Test", maxRetryDelayMs: 2_000 },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.CatalogProviderUnavailable });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts a hung request via the timeout signal", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    ) as unknown as typeof fetch;

    const promise = fetchJson(
      "https://example.test",
      {},
      {
        sourceLabel: "Test",
      },
    );
    const assertion = expect(promise).rejects.toMatchObject({
      code: ErrorCode.CatalogProviderUnavailable,
    });
    // 3 attempts × 10s timeout + backoff (500ms, 1000ms) between them.
    await jest.advanceTimersByTimeAsync(3 * 10_000 + 500 + 1_000);
    await assertion;

    jest.useRealTimers();
  });
});
