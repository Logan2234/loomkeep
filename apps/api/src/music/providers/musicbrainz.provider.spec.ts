import { ConfigService } from "@nestjs/config";
import { vi, type Mock } from "vitest";
import type { QuotaTrackerService } from "../../common/quota-tracker.service";
import { MusicBrainzProvider } from "./musicbrainz.provider";

// Node defines global fetch lazily, which confuses vi.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetch(payload: unknown, ok = true): Mock {
  const fn = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: ok ? 200 : 404,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** Route responses by a substring of the request URL (query string included). */
function mockFetchByUrl(routes: [string, unknown][]): Mock {
  const fn = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const match = routes.find(([part]) => url.includes(part));

    if (!match) {
      throw new Error(`Unexpected fetch call in test: ${url}`);
    }

    return Promise.resolve(
      new Response(JSON.stringify(match[1]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** Returns a different status/payload on each successive call, in order. */
function mockFetchSequence(
  responses: { status: number; payload?: unknown }[],
): Mock {
  let call = 0;
  const fn = vi.fn(() => {
    const { status, payload } = responses[Math.min(call, responses.length - 1)];
    call++;
    return Promise.resolve(
      new Response(JSON.stringify(payload ?? {}), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function providerWith(contact?: string): MusicBrainzProvider {
  const config = { get: vi.fn().mockReturnValue(contact) };
  const quota = { record: vi.fn() };
  return new MusicBrainzProvider(
    config as unknown as ConfigService,
    quota as unknown as QuotaTrackerService,
  );
}

describe("MusicBrainzProvider", () => {
  beforeEach(() => {
    // The provider throttles calls to ~1/s via Date.now(); advance it well
    // past the threshold on every read so tests don't actually sleep.
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 5000));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it("sends an identifying User-Agent and maps search results", async () => {
    const fn = mockFetch({
      "release-groups": [
        {
          id: "rg1",
          title: "Discovery",
          "primary-type": "Album",
          "first-release-date": "2001-03-12",
          "artist-credit": [
            { name: "Daft Punk", artist: { id: "artist1", name: "Daft Punk" } },
          ],
        },
      ],
    });

    const results = await providerWith("me@example.com").search("discovery");

    expect(fn.mock.calls[0][1]).toMatchObject({
      headers: { "User-Agent": "Loomkeep/1.0 (me@example.com)" },
    });
    expect(results).toEqual([
      {
        source: "MUSICBRAINZ",
        sourceId: "rg1",
        title: "Discovery",
        artists: ["Daft Punk"],
        year: 2001,
        coverUrl: "https://coverartarchive.org/release-group/rg1/front-250",
      },
    ]);
  });

  it("falls back to a generic User-Agent contact when none is configured", async () => {
    const fn = mockFetch({ "release-groups": [] });

    await providerWith(undefined).search("dune");

    expect(fn.mock.calls[0][1]).toMatchObject({
      headers: {
        "User-Agent": "Loomkeep/1.0 (self-hosted, no contact provided)",
      },
    });
  });

  it("maps details including genres, album type, release date, tags, links, label/catalog, tracks and same-artist albums", async () => {
    const otherAlbums = Array.from({ length: 12 }, (_, i) => ({
      id: `other-${i}`,
      title: `Album ${i}`,
      "artist-credit": [{ name: "Daft Punk" }],
    }));
    mockFetchByUrl([
      [
        "/release-group/rg1?",
        {
          id: "rg1",
          title: "Discovery",
          "primary-type": "Album",
          "first-release-date": "2001-03-12",
          "artist-credit": [
            { name: "Daft Punk", artist: { id: "artist1", name: "Daft Punk" } },
          ],
          genres: [{ name: "house" }, { name: "electronic" }],
          tags: [{ name: "french house" }, { name: "dance" }],
          disambiguation: "2001 release",
          relations: [
            { type: "discogs", url: { resource: "https://discogs.com/1" } },
            { type: "wikidata", url: { resource: "https://wikidata.org/1" } },
            // Unmapped relation types are dropped.
            { type: "allmusic", url: { resource: "https://allmusic.com/1" } },
          ],
        },
      ],
      [
        "/release?release-group=rg1",
        {
          releases: [
            {
              id: "release1",
              status: "Official",
              "label-info": [
                {
                  label: { name: "Virgin" },
                  "catalog-number": "7243 8496062 6",
                },
              ],
              media: [
                {
                  tracks: [
                    { position: 1, title: "One More Time", length: 320000 },
                    { position: 2, title: "Aerodynamic", length: 212000 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      [
        "coverartarchive.org/release-group/rg1",
        {
          images: [
            {
              image: "https://coverartarchive.org/rg1/front.jpg",
              types: ["Front"],
            },
            {
              image: "https://coverartarchive.org/rg1/back.jpg",
              types: ["Back"],
            },
          ],
        },
      ],
      [
        "/release-group?artist=artist1",
        {
          // Browsing by artist also returns the album itself — must be excluded.
          "release-groups": [
            {
              id: "rg1",
              title: "Discovery",
              "artist-credit": [{ name: "Daft Punk" }],
            },
            ...otherAlbums,
          ],
        },
      ],
    ]);

    const details = await providerWith("me@example.com").getDetails("rg1");

    expect(details).toEqual({
      summary: {
        source: "MUSICBRAINZ",
        sourceId: "rg1",
        title: "Discovery",
        artists: ["Daft Punk"],
        year: 2001,
        coverUrl: "https://coverartarchive.org/release-group/rg1/front-250",
      },
      genres: ["house", "electronic"],
      albumType: "Album",
      trackCount: 2,
      releaseDate: "2001-03-12T00:00:00.000Z",
      releaseDatePrecision: "day",
      sameArtistAlbums: details.sameArtistAlbums,
      externalIds: [{ source: "MUSICBRAINZ", externalId: "rg1" }],
      tags: ["french house", "dance"],
      disambiguation: "2001 release",
      externalLinks: [
        { label: "Discogs", url: "https://discogs.com/1" },
        { label: "Wikidata", url: "https://wikidata.org/1" },
      ],
      label: "Virgin",
      catalogNumber: "7243 8496062 6",
      tracks: [
        { position: 1, title: "One More Time", durationMs: 320000 },
        { position: 2, title: "Aerodynamic", durationMs: 212000 },
      ],
      totalDurationMs: 532000,
      extraCoverImages: [
        { url: "https://coverartarchive.org/rg1/back.jpg", type: "Back" },
      ],
    });
    expect(details.sameArtistAlbums).toHaveLength(10);
    expect(details.sameArtistAlbums.map((a) => a.sourceId)).not.toContain(
      "rg1",
    );
    expect(details.sameArtistAlbums[0]).toMatchObject({ sourceId: "other-0" });
  });

  it("accepts a year-only release date and tolerates a release/cover-art-free album", async () => {
    mockFetchByUrl([
      [
        "/release-group/rg1?",
        { id: "rg1", title: "Old Album", "first-release-date": "1977" },
      ],
      ["/release?release-group=", { releases: [] }],
      ["coverartarchive.org/release-group/rg1", null],
      ["/release-group?artist=", { "release-groups": [] }],
    ]);

    const details = await providerWith().getDetails("rg1");

    expect(details.releaseDate).toBe("1977-01-01T00:00:00.000Z");
    expect(details.releaseDatePrecision).toBe("year");
    expect(details.tracks).toEqual([]);
    expect(details.trackCount).toBeNull();
    expect(details.totalDurationMs).toBeNull();
    expect(details.label).toBeNull();
    expect(details.catalogNumber).toBeNull();
    expect(details.tags).toEqual([]);
    expect(details.disambiguation).toBeNull();
    expect(details.externalLinks).toEqual([]);
    expect(details.extraCoverImages).toEqual([]);
  });

  it("throws when MusicBrainz returns an error status for an id", async () => {
    mockFetch({ error: "Not Found" }, false);
    await expect(providerWith().getDetails("missing")).rejects.toThrow(
      "Album not found on MusicBrainz",
    );
  });

  it("retries a 503 rate limit and succeeds once it frees up", async () => {
    const fn = mockFetchSequence([
      { status: 503 },
      { status: 200, payload: { "release-groups": [] } },
    ]);

    const result = await providerWith().search("dune");

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });

  it("gives up after exhausting retries on repeated 503s", async () => {
    const fn = mockFetchSequence([{ status: 503 }]);

    await expect(providerWith().search("dune")).rejects.toThrow(
      "MusicBrainz request failed with status 503",
    );
    // 3 attempts total (1 initial + 2 retries), not an unbounded loop.
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
