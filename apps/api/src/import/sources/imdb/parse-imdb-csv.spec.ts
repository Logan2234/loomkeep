import { parseImdbCsv } from "./parse-imdb-csv";

/** IMDb's real export headers, verbatim — a rename must fail loudly here. */
const RATINGS_HEADER =
  "Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors";
const WATCHLIST_HEADER =
  "Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated";

function ratings(...rows: string[]): string {
  return [RATINGS_HEADER, ...rows].join("\n");
}

function watchlist(...rows: string[]): string {
  return [WATCHLIST_HEADER, ...rows].join("\n");
}

const HEAT =
  'tt0113277,9,2026-01-02,Heat,Heat,https://www.imdb.com/title/tt0113277/,Movie,8.3,170,1995,"Action, Crime",700000,1995-12-15,Michael Mann';

describe("parseImdbCsv — ratings export", () => {
  it("carries the IMDb id, which is what makes the match exact", () => {
    const { movies } = parseImdbCsv(ratings(HEAT));

    expect(movies[0].externalIds).toEqual({ imdb: "tt0113277" });
    expect(movies[0].rating).toBe(9);
    expect(movies[0].year).toBe(1995);
  });

  it("treats a rated film as watched but never dates the viewing", () => {
    // Date Rated is when the rating was typed: someone rating a back
    // catalogue in one sitting would otherwise date it all to that day.
    const { movies } = parseImdbCsv(ratings(HEAT));

    expect(movies[0].watched).toBe(true);
    expect(movies[0].watchedAt).toBeNull();
  });

  it("marks a rated series as completed rather than planned", () => {
    const { shows } = parseImdbCsv(
      ratings(
        "tt0903747,10,2026-01-02,Breaking Bad,Breaking Bad,https://x,TV Series,9.5,49,2008,Drama,2000000,2008-01-20,",
      ),
    );

    expect(shows[0].status).toBe("COMPLETED");
    expect(shows[0].rating).toBe(10);
    expect(shows[0].episodes).toEqual([]);
  });

  it("routes each title type to the right domain", () => {
    const { movies, shows } = parseImdbCsv(
      ratings(
        "tt1,7,2026-01-01,Un téléfilm,,https://x,TV Movie,6,90,2010,,,,",
        "tt2,7,2026-01-01,Un court,,https://x,Short,6,12,2010,,,,",
        "tt3,7,2026-01-01,Une mini-série,,https://x,TV Mini Series,8,50,2015,,,,",
      ),
    );

    expect(movies.map((m) => m.title)).toEqual(["Un téléfilm", "Un court"]);
    expect(shows.map((s) => s.title)).toEqual(["Une mini-série"]);
  });

  it("collects rated episodes separately, to be located against TMDB", () => {
    const { shows, movies, ratedEpisodes } = parseImdbCsv(
      ratings(
        "tt0959621,10,2026-01-01,Ozymandias,,https://x,TV Episode,9.9,48,2013,,,,",
      ),
    );

    expect(ratedEpisodes).toEqual([{ imdbId: "tt0959621", rating: 10 }]);
    expect(shows).toEqual([]);
    expect(movies).toEqual([]);
  });

  it("skips what this domain has no home for", () => {
    const result = parseImdbCsv(
      ratings(
        "tt4,9,2026-01-01,Un jeu,,https://x,Video Game,9,,2015,,,,",
        "tt5,9,2026-01-01,Un podcast,,https://x,Podcast Series,9,,2020,,,,",
      ),
    );

    expect(result.movies).toEqual([]);
    expect(result.shows).toEqual([]);
    expect(result.ratedEpisodes).toEqual([]);
  });

  it("ignores a row with no rating rather than inventing one", () => {
    const { movies } = parseImdbCsv(
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
    const { movies } = parseImdbCsv(`${bom}${ratings(HEAT)}`);

    expect(movies).toHaveLength(1);
    expect(movies[0].title).toBe("Heat");
  });

  it("returns nothing for an empty file", () => {
    expect(parseImdbCsv("")).toEqual({
      movies: [],
      shows: [],
      ratedEpisodes: [],
    });
  });
});

describe("parseImdbCsv — watchlist export", () => {
  const UNRATED =
    "1,tt0816692,2026-02-01,2026-02-01,,Interstellar,Interstellar,https://x,Movie,8.7,169,2014,Sci-Fi,2000000,2014-11-05,Christopher Nolan,,";

  it("keeps an unrated watchlist film unwatched", () => {
    const { movies } = parseImdbCsv(watchlist(UNRATED));

    expect(movies[0].watched).toBe(false);
    expect(movies[0].rating).toBeNull();
  });

  it("records when the title was put on the list", () => {
    const { movies } = parseImdbCsv(watchlist(UNRATED));

    expect(movies[0].addedAt?.toISOString().slice(0, 10)).toBe("2026-02-01");
  });

  it("treats a rated watchlist entry as already seen", () => {
    const { movies } = parseImdbCsv(
      watchlist(
        "1,tt0816692,2026-02-01,2026-02-01,,Interstellar,,https://x,Movie,8.7,169,2014,,,,,8,2026-03-01",
      ),
    );

    expect(movies[0].watched).toBe(true);
    expect(movies[0].rating).toBe(8);
  });

  it("keeps the user's own note on the entry", () => {
    const { movies } = parseImdbCsv(
      watchlist(
        '1,tt0816692,2026-02-01,2026-02-01,"À voir avec Léa",Interstellar,,https://x,Movie,8.7,169,2014,,,,,,',
      ),
    );

    expect(movies[0].notes).toBe("À voir avec Léa");
  });
});
