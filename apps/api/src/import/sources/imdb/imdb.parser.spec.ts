import { type ImdbFile, parseImdbExport } from "./imdb.parser";

/** IMDb's real export headers, verbatim — a rename must fail loudly here. */
const RATINGS_HEADER =
  "Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors";
const WATCHLIST_HEADER =
  "Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated";

function ratings(...rows: string[]): ImdbFile {
  return { name: "ratings.csv", text: [RATINGS_HEADER, ...rows].join("\n") };
}

function watchlist(...rows: string[]): ImdbFile {
  return {
    name: "WATCHLIST.csv",
    text: [WATCHLIST_HEADER, ...rows].join("\n"),
  };
}

function list(name: string, ...rows: string[]): ImdbFile {
  return { name, text: [WATCHLIST_HEADER, ...rows].join("\n") };
}

const parse = (...files: ImdbFile[]) => parseImdbExport(files);

const HEAT =
  'tt0113277,9,2026-01-02,Heat,Heat,https://www.imdb.com/title/tt0113277/,Movie,8.3,170,1995,"Action, Crime",700000,1995-12-15,Michael Mann';
const UNRATED =
  "1,tt0816692,2026-02-01,2026-02-01,,Interstellar,Interstellar,https://x,Movie,8.7,169,2014,Sci-Fi,2000000,2014-11-05,Christopher Nolan,,";

describe("parseImdbExport — ratings export", () => {
  it("carries the IMDb id, which is what makes the match exact", () => {
    const { movies } = parse(ratings(HEAT));

    expect(movies[0].externalIds).toEqual({ imdb: "tt0113277" });
    expect(movies[0].rating).toBe(9);
    expect(movies[0].year).toBe(1995);
  });

  it("treats a rated film as watched but never dates the viewing", () => {
    // Date Rated is when the rating was typed: someone rating a back
    // catalogue in one sitting would otherwise date it all to that day.
    const { movies } = parse(ratings(HEAT));

    expect(movies[0].watched).toBe(true);
    expect(movies[0].watchedAt).toBeNull();
    expect(movies[0].addedAt?.toISOString().slice(0, 10)).toBe("2026-01-02");
  });

  it("marks a rated series as being watched, not finished", () => {
    // Rating a series says nothing about how far the user got.
    const { shows } = parse(
      ratings(
        "tt0903747,10,2026-01-02,Breaking Bad,Breaking Bad,https://x,TV Series,9.5,49,2008,Drama,2000000,2008-01-20,",
      ),
    );

    expect(shows[0].status).toBe("WATCHING");
    expect(shows[0].rating).toBe(10);
    expect(shows[0].episodes).toEqual([]);
  });

  it.each([
    [
      "spaced",
      "TV Movie",
      "Short",
      "TV Mini Series",
      "TV Series",
      "TV Episode",
    ],
    ["camelCase", "tvMovie", "short", "tvMiniSeries", "tvSeries", "tvEpisode"],
    [
      "legacy",
      "Feature Film",
      "Short Film",
      "Mini-Series",
      "TV Series",
      "TV Episode",
    ],
  ])(
    "routes %s title types to the right domain",
    (_spelling, tvMovie, short, miniSeries, series, episode) => {
      const result = parse(
        ratings(
          `tt1,7,2026-01-01,Un téléfilm,,https://x,${tvMovie},6,90,2010,,,,`,
          `tt2,7,2026-01-01,Un court,,https://x,${short},6,12,2010,,,,`,
          `tt3,7,2026-01-01,Une mini-série,,https://x,${miniSeries},8,50,2015,,,,`,
          `tt4,7,2026-01-01,Une série,,https://x,${series},8,50,2015,,,,`,
          `tt5,9,2026-01-01,Un épisode,,https://x,${episode},8,50,2015,,,,`,
        ),
      );

      expect(result.movies.map((m) => m.title)).toEqual([
        "Un téléfilm",
        "Un court",
      ]);
      expect(result.shows.map((s) => s.title)).toEqual([
        "Une mini-série",
        "Une série",
      ]);
      expect(result.ratedEpisodes).toEqual([{ imdbId: "tt5", rating: 9 }]);
    },
  );

  it("skips what this domain has no home for", () => {
    const result = parse(
      ratings(
        "tt4,9,2026-01-01,Un jeu,,https://x,Video Game,9,,2015,,,,",
        "tt5,9,2026-01-01,Un podcast,,https://x,Podcast Series,9,,2020,,,,",
      ),
    );

    expect(result.movies).toEqual([]);
    expect(result.shows).toEqual([]);
    expect(result.ratedEpisodes).toEqual([]);
  });

  it("skips a row whose id is not an IMDb title id", () => {
    // The id ends up in a TMDB URL path: anything else could reach another
    // endpoint with the server's token.
    const result = parse(
      ratings(
        "../account?x=,9,2026-01-01,Piège,,https://x,Movie,9,,2015,,,,",
        "nm0000123,9,2026-01-01,Une personne,,https://x,Movie,9,,2015,,,,",
      ),
    );

    expect(result.movies).toEqual([]);
  });

  it("ignores a row with no rating rather than inventing one", () => {
    const { movies } = parse(
      ratings("tt6,,2026-01-01,Sans note,,https://x,Movie,7,100,2001,,,,"),
    );

    expect(movies[0].rating).toBeNull();
    // Still watched: it is in the ratings export at all.
    expect(movies[0].watched).toBe(true);
  });

  it("survives the byte-order mark IMDb puts in front of the header", () => {
    // Built from its code point rather than typed: a literal BOM is invisible
    // in the source, and ESLint rejects it as irregular whitespace.
    const bom = String.fromCharCode(0xfeff);
    const file = ratings(HEAT);
    const { movies } = parse({ ...file, text: `${bom}${file.text}` });

    expect(movies).toHaveLength(1);
    expect(movies[0].title).toBe("Heat");
  });

  it("returns nothing for an empty file", () => {
    expect(parse({ name: null, text: "" })).toEqual({
      movies: [],
      shows: [],
      ratedEpisodes: [],
      lists: [],
    });
  });
});

describe("parseImdbExport — watchlist export", () => {
  it("keeps an unrated watchlist film unwatched", () => {
    const { movies } = parse(watchlist(UNRATED));

    expect(movies[0].watched).toBe(false);
    expect(movies[0].rating).toBeNull();
  });

  it("records when the title was put on the list", () => {
    const { movies } = parse(watchlist(UNRATED));

    expect(movies[0].addedAt?.toISOString().slice(0, 10)).toBe("2026-02-01");
  });

  it("treats a rated watchlist entry as already seen", () => {
    const { movies } = parse(
      watchlist(
        "1,tt0816692,2026-02-01,2026-02-01,,Interstellar,,https://x,Movie,8.7,169,2014,,,,,8,2026-03-01",
      ),
    );

    expect(movies[0].watched).toBe(true);
    expect(movies[0].rating).toBe(8);
  });

  it("does not count an unrated episode on the watchlist as watched", () => {
    const { ratedEpisodes } = parse(
      watchlist(
        "1,tt0959621,2026-02-01,2026-02-01,,Ozymandias,,https://x,TV Episode,9.9,48,2013,,,,,,",
        "2,tt2301451,2026-02-01,2026-02-01,,Fly,,https://x,TV Episode,7.9,47,2010,,,,,7,2026-03-01",
      ),
    );

    expect(ratedEpisodes).toEqual([{ imdbId: "tt2301451", rating: 7 }]);
  });

  it("keeps the user's own note on the entry", () => {
    const { movies } = parse(
      watchlist(
        '1,tt0816692,2026-02-01,2026-02-01,"À voir avec Léa",Interstellar,,https://x,Movie,8.7,169,2014,,,,,,',
      ),
    );

    expect(movies[0].notes).toBe("À voir avec Léa");
  });

  it("reads a bare CSV without a file name as the watchlist", () => {
    const file = watchlist(UNRATED);
    const result = parse({ name: null, text: file.text });

    expect(result.movies).toHaveLength(1);
    expect(result.lists).toEqual([]);
  });
});

describe("parseImdbExport — several files at once", () => {
  it("merges a title found in the ratings and on the watchlist", () => {
    const { movies } = parse(
      watchlist(
        "1,tt0113277,2025-06-01,2025-06-01,Revoir en 4K,Heat,,https://x,Movie,8.3,170,1995,,,,,,",
      ),
      ratings(HEAT),
    );

    expect(movies).toHaveLength(1);
    expect(movies[0]).toMatchObject({
      watched: true,
      rating: 9,
      notes: "Revoir en 4K",
    });
    expect(movies[0].addedAt?.toISOString().slice(0, 10)).toBe("2025-06-01");
  });

  it("turns any other list file into a list, named after the file", () => {
    const result = parse(
      list(
        "Mes polars.csv",
        "1,tt0113277,2025-06-01,2025-06-01,Le meilleur,Heat,,https://x,Movie,8.3,170,1995,,,,,,",
        "2,tt0903747,2025-06-01,2025-06-01,,Breaking Bad,,https://x,TV Series,9.5,49,2008,,,,,,",
        "3,tt0959621,2025-06-01,2025-06-01,,Ozymandias,,https://x,TV Episode,9.9,48,2013,,,,,,",
      ),
    );

    // Being on a list is not tracking: nothing reaches the library.
    expect(result.movies).toEqual([]);
    expect(result.shows).toEqual([]);
    expect(result.lists).toEqual([
      {
        name: "Mes polars",
        description: null,
        items: [
          {
            title: "Heat",
            year: 1995,
            externalIds: { imdb: "tt0113277" },
            type: "MOVIE",
            note: "Le meilleur",
          },
          {
            title: "Breaking Bad",
            year: 2008,
            externalIds: { imdb: "tt0903747" },
            type: "SERIES",
            note: null,
          },
        ],
      },
    ]);
  });

  it("tells the watchlist from a list by its file name", () => {
    const result = parse(
      list("my-watchlist (1).csv", UNRATED),
      list("ls012345678.csv", UNRATED),
    );

    expect(result.movies).toHaveLength(1);
    expect(result.lists.map((l) => l.name)).toEqual(["ls012345678"]);
  });
});
