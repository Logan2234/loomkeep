import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import { MetricsService } from "../metrics/metrics.service";
import { ProviderHttpService } from "./provider-http.service";
import type { QuotaTrackerService } from "./quota-tracker.service";

const originalFetch = global.fetch;

function response(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as Response;
}

function make(contact?: string) {
  const quota = { record: vi.fn() } as unknown as QuotaTrackerService & {
    record: ReturnType<typeof vi.fn>;
  };
  const metrics = new MetricsService();
  const config = {
    get: vi.fn().mockReturnValue(contact),
  } as unknown as ConfigService;
  return {
    service: new ProviderHttpService(config, quota, metrics),
    quota,
    metrics,
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("ProviderHttpClient", () => {
  it("counts every attempt against the quota and the metrics, retries included", async () => {
    vi.spyOn(global, "setTimeout").mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as unknown as typeof setTimeout);
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(
        response(200, { ok: true }),
      ) as unknown as typeof fetch;
    const { service, quota, metrics } = make();

    await service
      .client({ provider: "tmdb", sourceLabel: "TMDB" })
      .fetchJson("https://example.test", {});

    expect(quota.record).toHaveBeenCalledTimes(2);
    const rendered = await metrics.render();
    expect(rendered).toContain(
      'provider_requests_total{provider="tmdb",outcome="rate_limited"} 1',
    );
    expect(rendered).toContain(
      'provider_requests_total{provider="tmdb",outcome="ok"} 1',
    );
  });

  it("waits its interval between two requests, whoever makes them", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(response(200)) as unknown as typeof fetch;
    const { service } = make();
    const client = service.client({
      provider: "openLibrary",
      sourceLabel: "Open Library",
      minIntervalMs: 50,
    });

    const started = Date.now();
    await Promise.all([
      client.fetchJson("https://example.test/a", {}),
      client.fetchJson("https://example.test/b", {}),
    ]);

    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });

  it("names the instance's contact in the User-Agent when asked to", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { service } = make("admin@example.test");

    await service
      .client({
        provider: "musicbrainz",
        sourceLabel: "MusicBrainz",
        identify: true,
      })
      .fetchJson("https://example.test", {
        headers: { Accept: "application/json" },
      });

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "User-Agent": "Loomkeep/1.0 (admin@example.test)",
      Accept: "application/json",
    });
  });
});

describe("ProviderHttpService", () => {
  it("warns at startup when API_CONTACT is empty, and only then", () => {
    const anonymous = make();
    const warnAnonymous = vi.spyOn(
      (anonymous.service as unknown as { logger: { warn: () => void } }).logger,
      "warn",
    );
    anonymous.service.onApplicationBootstrap();
    expect(warnAnonymous).toHaveBeenCalledOnce();

    const identified = make("admin@example.test");
    const warnIdentified = vi.spyOn(
      (identified.service as unknown as { logger: { warn: () => void } })
        .logger,
      "warn",
    );
    identified.service.onApplicationBootstrap();
    expect(warnIdentified).not.toHaveBeenCalled();
  });
});
