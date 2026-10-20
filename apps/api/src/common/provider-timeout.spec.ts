import { ErrorCode } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import { OpenLibraryProvider } from "../books/providers/open-library.provider";
import { MusicBrainzProvider } from "../music/providers/musicbrainz.provider";
import type { QuotaTrackerService } from "./quota-tracker.service";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe.each([
  ["Open Library", OpenLibraryProvider],
  ["MusicBrainz", MusicBrainzProvider],
] as const)("%s HTTP failures", (_name, Provider) => {
  const make = () =>
    new Provider(
      { get: vi.fn() } as unknown as ConfigService,
      { record: vi.fn() } as unknown as QuotaTrackerService,
    );

  it("maps network failures to a provider-unavailable error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const result = make()
      .search("test")
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(await result).toMatchObject({
      code: ErrorCode.CatalogProviderUnavailable,
    });
  });

  it("keeps network failures on detail pages distinct from missing items", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const result = make()
      .getDetails("OL1W")
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(await result).toMatchObject({
      code: ErrorCode.CatalogProviderUnavailable,
    });
  });

  it("aborts hung attempts and returns a provider-unavailable error", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = make()
      .search("test")
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(await result).toMatchObject({
      code: ErrorCode.CatalogProviderUnavailable,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

it("throttles and counts every MusicBrainz retry while only retrying HTTP 503", async () => {
  vi.useFakeTimers();
  const record = vi.fn();
  const provider = new MusicBrainzProvider(
    { get: vi.fn() } as unknown as ConfigService,
    { record } as unknown as QuotaTrackerService,
  );
  const times: number[] = [];
  const fetchMock = vi.fn(() => {
    times.push(Date.now());
    return Promise.resolve(
      new Response("{}", { status: times.length === 1 ? 503 : 200 }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  const result = provider.search("test");
  await vi.advanceTimersByTimeAsync(3_000);
  await result;
  expect(times[1] - times[0]).toBeGreaterThanOrEqual(1050);
  expect(record.mock.calls).toEqual([["musicbrainz"], ["musicbrainz"]]);
  fetchMock.mockClear().mockResolvedValue(new Response("{}", { status: 500 }));
  const failed = provider.search("test").catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(3_000);
  expect(await failed).toMatchObject({
    code: ErrorCode.CatalogProviderUnavailable,
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
