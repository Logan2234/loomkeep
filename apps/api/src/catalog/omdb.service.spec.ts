import { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { QuotaTrackerService } from "../common/quota-tracker.service";
import { OmdbService } from "./omdb.service";

const originalFetch = global.fetch;

function service(apiKey: string | undefined): OmdbService {
  const config = { get: vi.fn().mockReturnValue(apiKey) };
  const quota = { record: vi.fn() };
  return new OmdbService(
    config as unknown as ConfigService,
    quota as unknown as QuotaTrackerService,
  );
}

describe("OmdbService", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns nothing (and does not fetch) when no key is set", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(service(undefined).getRatings("tt123")).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns nothing when there is no IMDb id", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(service("key").getRatings(null)).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps OMDb ratings to short-labelled scores", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Response: "True",
          Ratings: [
            { Source: "Internet Movie Database", Value: "8.5/10" },
            { Source: "Rotten Tomatoes", Value: "91%" },
            { Source: "Metacritic", Value: "78/100" },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    await expect(service("key").getRatings("tt1375666")).resolves.toEqual([
      {
        source: "IMDb",
        score: "8.5/10",
        url: "https://www.imdb.com/title/tt1375666/",
      },
      { source: "RT", score: "91%" },
      { source: "Metacritic", score: "78/100" },
    ]);
  });

  it("returns nothing when OMDb has no match", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ Response: "False" }), { status: 200 }),
      ) as unknown as typeof fetch;

    await expect(service("key").getRatings("tt000")).resolves.toEqual([]);
  });

  it("swallows network errors", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("network")) as unknown as typeof fetch;

    await expect(service("key").getRatings("tt000")).resolves.toEqual([]);
  });
});
