import { parseLetterboxdExport } from "./letterboxd.parser";

/** The export's real headers, so a column rename shows up as a failing test. */
const DIARY_HEADER =
  "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date";
const REVIEWS_HEADER =
  "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date";
const RATINGS_HEADER = "Date,Name,Year,Letterboxd URI,Rating";
const PLAIN_HEADER = "Date,Name,Year,Letterboxd URI";

function entries(files: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(files));
}

function movieNamed(
  result: ReturnType<typeof parseLetterboxdExport>,
  title: string,
) {
  return result.movies.find((m) => m.title === title);
}

describe("parseLetterboxdExport — films", () => {
  it("turns half-star ratings into the 0-10 scale", () => {
    const result = parseLetterboxdExport(
      entries({
        "ratings.csv": `${RATINGS_HEADER}\n2026-01-02,Dune,2021,https://boxd.it/aaa,4.5\n`,
      }),
    );

    expect(movieNamed(result, "Dune")?.rating).toBe(9);
  });

  it("marks a rated film as watched even when no diary entry exists", () => {
    const result = parseLetterboxdExport(
      entries({
        "ratings.csv": `${RATINGS_HEADER}\n2026-01-02,Dune,2021,https://boxd.it/aaa,3\n`,
      }),
    );

    expect(movieNamed(result, "Dune")?.watched).toBe(true);
  });

  it("keeps the earliest viewing as the watch and the rest as rewatches", () => {
    const result = parseLetterboxdExport(
      entries({
        "diary.csv": [
          DIARY_HEADER,
          "2026-03-01,Heat,1995,https://boxd.it/b,5,Yes,,2026-02-20",
          "2026-01-10,Heat,1995,https://boxd.it/b,5,,,2026-01-05",
          "2026-05-01,Heat,1995,https://boxd.it/b,5,Yes,,2026-04-30",
        ].join("\n"),
      }),
    );

    const heat = movieNamed(result, "Heat");
    expect(heat?.watchedAt?.toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(heat?.rewatchedAt.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-02-20",
      "2026-04-30",
    ]);
  });

  it("lets ratings.csv override the rating a diary entry carried", () => {
    // The diary keeps the rating as it was that night; ratings.csv is what the
    // profile shows today.
    const result = parseLetterboxdExport(
      entries({
        "diary.csv": `${DIARY_HEADER}\n2026-01-10,Heat,1995,https://boxd.it/b,2,,,2026-01-05`,
        "ratings.csv": `${RATINGS_HEADER}\n2026-06-01,Heat,1995,https://boxd.it/b,4.5`,
      }),
    );

    expect(movieNamed(result, "Heat")?.rating).toBe(9);
  });

  it("imports a review body and keeps the longest when several viewings have one", () => {
    const result = parseLetterboxdExport(
      entries({
        "reviews.csv": [
          REVIEWS_HEADER,
          "2026-01-10,Heat,1995,https://boxd.it/b,4,,Court.,,2026-01-05",
          "2026-02-10,Heat,1995,https://boxd.it/b,4,Yes,Une critique nettement plus longue.,,2026-02-05",
        ].join("\n"),
      }),
    );

    expect(movieNamed(result, "Heat")?.review).toBe(
      "Une critique nettement plus longue.",
    );
  });

  it("keeps a watchlist film unwatched and records when it was added", () => {
    const result = parseLetterboxdExport(
      entries({
        "watchlist.csv": `${PLAIN_HEADER}\n2026-04-01,Sicario,2015,https://boxd.it/c\n`,
      }),
    );

    const sicario = movieNamed(result, "Sicario");
    expect(sicario?.watched).toBe(false);
    expect(sicario?.addedAt?.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("never turns the marked-watched date into a viewing date", () => {
    // watched.csv's Date is the day of the click — for a bulk "mark all
    // watched" that would date an entire library to one afternoon.
    const result = parseLetterboxdExport(
      entries({
        "watched.csv": `${PLAIN_HEADER}\n2026-04-01,Alien,1979,https://boxd.it/d\n`,
      }),
    );

    const alien = movieNamed(result, "Alien");
    expect(alien?.watched).toBe(true);
    expect(alien?.watchedAt).toBeNull();
  });

  it("folds the same film across files into one entry", () => {
    const result = parseLetterboxdExport(
      entries({
        "watched.csv": `${PLAIN_HEADER}\n2026-04-01,Alien,1979,https://boxd.it/d`,
        "ratings.csv": `${RATINGS_HEADER}\n2026-04-02,Alien,1979,https://boxd.it/d,5`,
        "diary.csv": `${DIARY_HEADER}\n2026-04-03,Alien,1979,https://boxd.it/d,5,,,2026-04-01`,
      }),
    );

    expect(result.movies).toHaveLength(1);
    expect(result.movies[0].rating).toBe(10);
  });

  it("distinguishes two films sharing a title by their year", () => {
    const result = parseLetterboxdExport(
      entries({
        "watched.csv": [
          PLAIN_HEADER,
          "2026-04-01,Dune,1984,https://boxd.it/e",
          "2026-04-01,Dune,2021,https://boxd.it/f",
        ].join("\n"),
      }),
    );

    expect(result.movies.map((m) => m.year).sort()).toEqual([1984, 2021]);
  });

  it("flags the profile's favourite films, ignoring likes entirely", () => {
    const result = parseLetterboxdExport(
      entries({
        "watched.csv": [
          PLAIN_HEADER,
          "2026-04-01,Heat,1995,https://boxd.it/b",
          "2026-04-01,Alien,1979,https://boxd.it/d",
        ].join("\n"),
        "profile.csv": `Date Joined,Username,Favorite Films\n2020-01-01,logan,"Heat, Mulholland Drive"\n`,
      }),
    );

    expect(movieNamed(result, "Heat")?.favorite).toBe(true);
    expect(movieNamed(result, "Alien")?.favorite).toBeUndefined();
  });

  it("finds pinned favourites by their link, whatever their title", () => {
    const result = parseLetterboxdExport(
      entries({
        "watched.csv": [
          PLAIN_HEADER,
          "2026-04-01,Crouching Tiger, Hidden Dragon,2000,https://boxd.it/c",
          "2026-04-01,Alien,1979,https://boxd.it/d",
        ]
          .join("\n")
          .replace(
            "Crouching Tiger, Hidden Dragon",
            '"Crouching Tiger, Hidden Dragon"',
          ),
        "profile.csv": `Date Joined,Username,Favorite Films\n2020-01-01,logan,"https://boxd.it/c, https://boxd.it/zzz"\n`,
      }),
    );

    expect(movieNamed(result, "Crouching Tiger, Hidden Dragon")?.favorite).toBe(
      true,
    );
    expect(movieNamed(result, "Alien")?.favorite).toBeUndefined();
  });

  it("reports no film for an export with none of the known files", () => {
    expect(parseLetterboxdExport(entries({}))).toEqual({
      movies: [],
      lists: [],
    });
  });
});

describe("parseLetterboxdExport — lists", () => {
  const LIST_CSV = [
    "Letterboxd list export v7",
    "Date,Name,Tags,URL,Description",
    '2026-01-01,Mon top noir,,https://boxd.it/list,"Les meilleurs films noirs"',
    "",
    "Position,Name,Year,URL,Description",
    "1,Chinatown,1974,https://boxd.it/g,Le scénario",
    "2,Heat,1995,https://boxd.it/b,",
  ].join("\n");

  it("reads the list's own name and description from its metadata block", () => {
    const result = parseLetterboxdExport(
      entries({ "lists/mon-top-noir.csv": LIST_CSV }),
    );

    expect(result.lists).toHaveLength(1);
    expect(result.lists[0].name).toBe("Mon top noir");
    expect(result.lists[0].description).toBe("Les meilleurs films noirs");
  });

  it("keeps the films in their export order", () => {
    const result = parseLetterboxdExport(
      entries({ "lists/mon-top-noir.csv": LIST_CSV }),
    );

    expect(result.lists[0].items.map((f) => f.title)).toEqual([
      "Chinatown",
      "Heat",
    ]);
  });

  it("keeps the user's note on each film of the list", () => {
    const result = parseLetterboxdExport(
      entries({ "lists/mon-top-noir.csv": LIST_CSV }),
    );

    expect(result.lists[0].items.map((f) => f.note)).toEqual([
      "Le scénario",
      null,
    ]);
  });

  it("keeps a description that runs over several paragraphs", () => {
    // Quoted, so its blank line is part of the field, not the separator.
    const result = parseLetterboxdExport(
      entries({
        "lists/noir.csv": LIST_CSV.replace(
          '"Les meilleurs films noirs"',
          '"Les meilleurs films noirs.\n\nDans le désordre."',
        ),
      }),
    );

    expect(result.lists[0].description).toBe(
      "Les meilleurs films noirs.\n\nDans le désordre.",
    );
    expect(result.lists[0].items).toHaveLength(2);
  });

  it("falls back to the file name when the metadata block has no name", () => {
    const withoutMeta = [
      "Position,Name,Year,URL,Description",
      "1,Chinatown,1974,https://boxd.it/g,",
    ].join("\n");

    const result = parseLetterboxdExport(
      entries({ "lists/watchlist-2026.csv": withoutMeta }),
    );

    expect(result.lists[0].name).toBe("watchlist-2026");
  });

  it("finds lists nested under the archive's wrapper folder", () => {
    const result = parseLetterboxdExport(
      entries({ "letterboxd-logan-2026-01-01/lists/top.csv": LIST_CSV }),
    );

    expect(result.lists).toHaveLength(1);
  });

  it("does not add a list's films to the library", () => {
    // Being on a list is not tracking; the commit only caches them.
    const result = parseLetterboxdExport(
      entries({ "lists/mon-top-noir.csv": LIST_CSV }),
    );

    expect(result.movies).toEqual([]);
  });
});
