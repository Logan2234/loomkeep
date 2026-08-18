import { ConfigService } from "@nestjs/config";
import type { QuotaTrackerService } from "../../common/quota-tracker.service";
import { OpenLibraryProvider } from "./open-library.provider";

// Node defines global fetch lazily, which confuses jest.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetch(payload: unknown, ok = true): jest.Mock {
  const fn = jest.fn(() =>
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
function mockFetchByUrl(routes: [string, unknown][]): jest.Mock {
  const fn = jest.fn((input: RequestInfo | URL) => {
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
): jest.Mock {
  let call = 0;
  const fn = jest.fn(() => {
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

function providerWith(contact?: string): OpenLibraryProvider {
  const config = { get: jest.fn().mockReturnValue(contact) };
  const quota = { record: jest.fn() };
  return new OpenLibraryProvider(
    config as unknown as ConfigService,
    quota as unknown as QuotaTrackerService,
  );
}

/** The URL of the nth fetch call, percent-decoded for readable assertions. */
function calledUrl(fn: jest.Mock, index = 0): string {
  return decodeURIComponent(String(fn.mock.calls[index][0]));
}

const HOBBIT_DOC = {
  key: "/works/OL27482W",
  title: "The Hobbit",
  author_name: ["J.R.R. Tolkien"],
  author_key: ["OL26320A"],
  first_publish_year: 1937,
  cover_i: 14627570,
};

const HOBBIT_SUMMARY = {
  source: "OPEN_LIBRARY",
  sourceId: "OL27482W",
  title: "The Hobbit",
  authors: ["J.R.R. Tolkien"],
  year: 1937,
  coverUrl: "https://covers.openlibrary.org/b/id/14627570-L.jpg",
  isAdult: false,
};

describe("OpenLibraryProvider", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("identifies itself with a contact User-Agent and maps search results", async () => {
    const fn = mockFetch({ numFound: 1, docs: [HOBBIT_DOC] });

    const results = await providerWith("hi@loomkeep.app").search("hobbit");

    expect(fn.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({
        "User-Agent": "Loomkeep/1.0 (hi@loomkeep.app)",
      }),
    });
    expect(results).toEqual([HOBBIT_SUMMARY]);
  });

  it("falls back to a generic User-Agent when no contact is configured", async () => {
    const fn = mockFetch({ numFound: 0 });

    await providerWith(undefined).search("hobbit");

    expect(fn.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({
        "User-Agent": "Loomkeep/1.0 (self-hosted, no contact provided)",
      }),
    });
  });

  it("never flags a book as adult — Open Library carries no maturity rating", async () => {
    mockFetch({ numFound: 1, docs: [{ ...HOBBIT_DOC, subject: ["Erotica"] }] });

    const results = await providerWith("k").search("adult");

    expect(results[0].isAdult).toBe(false);
  });

  it("resolves a single work by ISBN, or null when none", async () => {
    const fn = mockFetch({ numFound: 1, docs: [HOBBIT_DOC] });
    await expect(
      providerWith("k").searchByIsbn("9780261102217"),
    ).resolves.toMatchObject({ sourceId: "OL27482W", title: "The Hobbit" });
    expect(calledUrl(fn)).toContain("q=isbn:9780261102217");

    mockFetch({ numFound: 0, docs: [] });
    await expect(
      providerWith("k").searchByIsbn("0000000000"),
    ).resolves.toBeNull();
  });

  it("merges the work document and the Solr doc into details", async () => {
    mockFetchByUrl([
      [
        "/works/OL27482W.json",
        {
          key: "/works/OL27482W",
          title: "The Hobbit",
          subtitle: "There and Back Again",
          description: "<p>A <b>hobbit</b> goes on an adventure.</p>",
          first_publish_date: "1937-09-21",
          covers: [14627570],
        },
      ],
      [
        "q=key%3A",
        {
          numFound: 1,
          docs: [
            {
              ...HOBBIT_DOC,
              publisher: ["George Allen & Unwin", "Houghton Mifflin"],
              subject: ["Fiction", "Fantasy"],
              number_of_pages_median: 310,
            },
          ],
        },
      ],
      ["author_key%3A", { numFound: 0, docs: [] }],
    ]);

    const details = await providerWith("k").getDetails("OL27482W");

    expect(details).toEqual({
      summary: HOBBIT_SUMMARY,
      overview: "A hobbit goes on an adventure.",
      subtitle: "There and Back Again",
      publisher: "George Allen & Unwin",
      genres: ["Fiction", "Fantasy"],
      pageCount: 310,
      releaseDate: "1937-09-21T00:00:00.000Z",
      website: "https://openlibrary.org/works/OL27482W",
      sameAuthorBooks: [],
      ratings: [],
      externalIds: [{ source: "OPEN_LIBRARY", externalId: "OL27482W" }],
    });
  });

  it("keeps only full publication dates, and cleans up the subject list", async () => {
    mockFetchByUrl([
      [
        "/works/OL27482W.json",
        { title: "The Hobbit", first_publish_date: "October 1937" },
      ],
      [
        "q=key%3A",
        {
          numFound: 1,
          docs: [
            {
              ...HOBBIT_DOC,
              subject: [
                "Fantasy",
                "fantasy", // Case variant of one already kept.
                "nyt:mass-market-monthly=2021-11-07", // Machine tag.
                "A long sentence describing the plot of the book in detail",
                ...Array.from({ length: 30 }, (_, i) => `Subject ${i}`),
              ],
            },
          ],
        },
      ],
      ["author_key%3A", { numFound: 0, docs: [] }],
    ]);

    const details = await providerWith("k").getDetails("OL27482W");

    expect(details.releaseDate).toBeNull();
    expect(details.genres).toHaveLength(10);
    expect(details.genres.slice(0, 2)).toEqual(["Fantasy", "Subject 0"]);
  });

  it("follows the redirect stub of a work merged into another one", async () => {
    const fn = mockFetchByUrl([
      [
        "/works/OL893415W.json",
        {
          key: "/works/OL893415W",
          type: { key: "/type/redirect" },
          location: "/works/OL893414W",
        },
      ],
      ["/works/OL893414W.json", { key: "/works/OL893414W", title: "Dune" }],
      ["q=key%3A", { numFound: 0, docs: [] }],
    ]);

    const details = await providerWith("k").getDetails("OL893415W");

    expect(fn).toHaveBeenCalledTimes(3);
    expect(details.summary.title).toBe("Dune");
    // Everything keys off the canonical id, not the alias that was asked for.
    expect(calledUrl(fn, 2)).toContain("q=key:/works/OL893414W");
    expect(details.summary.sourceId).toBe("OL893414W");
    expect(details.website).toBe("https://openlibrary.org/works/OL893414W");
    expect(details.externalIds).toEqual([
      { source: "OPEN_LIBRARY", externalId: "OL893414W" },
    ]);
  });

  it("maps ratings_average/ratings_count to an Open Library score", async () => {
    mockFetchByUrl([
      ["/works/OL27482W.json", { title: "The Hobbit" }],
      [
        "q=key%3A",
        {
          numFound: 1,
          docs: [
            { ...HOBBIT_DOC, ratings_average: 4.3061223, ratings_count: 128 },
          ],
        },
      ],
      ["author_key%3A", { numFound: 0, docs: [] }],
    ]);

    const details = await providerWith("k").getDetails("OL27482W");

    expect(details.ratings).toEqual([
      { source: "Open Library", score: "4.3/5 (128)" },
    ]);
  });

  it("omits the rating when Open Library reports none", async () => {
    mockFetchByUrl([
      ["/works/OL27482W.json", { title: "The Hobbit" }],
      ["q=key%3A", { numFound: 1, docs: [HOBBIT_DOC] }],
      ["author_key%3A", { numFound: 0, docs: [] }],
    ]);

    const details = await providerWith("k").getDetails("OL27482W");

    expect(details.ratings).toEqual([]);
  });

  it("maps same-author books by author key, excluding this work, capped at 10", async () => {
    const otherBooks = Array.from({ length: 12 }, (_, i) => ({
      key: `/works/OL${i}W`,
      title: `Book ${i}`,
      author_name: ["J.R.R. Tolkien"],
    }));
    const fn = mockFetchByUrl([
      ["/works/OL27482W.json", { title: "The Hobbit" }],
      ["q=key%3A", { numFound: 1, docs: [HOBBIT_DOC] }],
      [
        "author_key%3A",
        {
          numFound: 13,
          // The author search also returns the work itself — must be excluded.
          docs: [HOBBIT_DOC, ...otherBooks],
        },
      ],
    ]);

    const details = await providerWith("k").getDetails("OL27482W");

    expect(calledUrl(fn, 2)).toContain("q=author_key:OL26320A");
    expect(calledUrl(fn, 2)).toContain("sort=rating");
    expect(details.sameAuthorBooks).toHaveLength(10);
    expect(details.sameAuthorBooks.map((b) => b.sourceId)).not.toContain(
      "OL27482W",
    );
    expect(details.sameAuthorBooks[0]).toMatchObject({ sourceId: "OL0W" });
  });

  it("throws when Open Library returns an error status for a work id", async () => {
    mockFetch({ error: "notfound" }, false);
    await expect(providerWith("k").getDetails("OL404W")).rejects.toThrow(
      "Book not found on Open Library",
    );
  });

  it("retries a 429 rate limit and succeeds once the quota frees up", async () => {
    const fn = mockFetchSequence([
      { status: 429 },
      { status: 200, payload: { numFound: 0 } },
    ]);

    const result = await providerWith("k").search("dune");

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });

  it("gives up after exhausting retries on repeated 429s", async () => {
    const fn = mockFetchSequence([{ status: 429 }]);

    await expect(providerWith("k").search("dune")).rejects.toThrow(
      "Open Library request failed with status 429",
    );
    // 3 attempts total (1 initial + 2 retries), not an unbounded loop.
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("resolves many ISBNs in one OR-joined call, keyed by the matched identifier", async () => {
    const fn = mockFetch({
      numFound: 2,
      docs: [
        { ...HOBBIT_DOC, isbn: ["0261102214", "9780261102217"] },
        {
          key: "/works/OL893414W",
          title: "Dune",
          isbn: ["9781961108042", "0441013597"],
        },
      ],
    });

    const { matches, failedIsbns } = await providerWith("k").searchByIsbns([
      "9780261102217",
      "9781961108042",
    ]);

    expect(calledUrl(fn)).toContain("q=isbn:(9780261102217+OR+9781961108042)");
    expect(matches.size).toBe(2);
    expect(matches.get("9780261102217")).toMatchObject({
      sourceId: "OL27482W",
    });
    expect(matches.get("9781961108042")).toMatchObject({
      sourceId: "OL893414W",
    });
    // Editions not asked for don't leak into the result map.
    expect(matches.has("0441013597")).toBe(false);
    expect(failedIsbns).toEqual([]);
  });

  it("chunks ISBN batches at 20 and reports a failed chunk without retrying it individually", async () => {
    const isbns = Array.from({ length: 25 }, (_, i) => `978000000000${i}`);
    const fn = jest
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error("network down")))
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ numFound: 0 }), { status: 200 }),
        ),
      );
    global.fetch = fn as unknown as typeof fetch;

    const { matches, failedIsbns } =
      await providerWith("k").searchByIsbns(isbns);

    // 2 chunks (20 + 5) → 2 calls, not 25.
    expect(fn).toHaveBeenCalledTimes(2);
    expect(matches.size).toBe(0);
    expect(failedIsbns).toEqual(isbns.slice(0, 20));
  });
});
