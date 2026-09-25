import { parseGoodreadsCsv } from "./goodreads-parse";

const HEADER =
  "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseGoodreadsCsv", () => {
  it("maps a finished, rated book and combines private notes + review", () => {
    const rows = parseGoodreadsCsv(
      csv(
        '1,Résister,Salomé Saqué,"Saqué, Salomé",,1961108046,9781961108042,4,3.90,Editions,Paperback,224,2023,2023,2025/03/31,2025/01/01,read,read (#1),read,"Great read",0,"Lend to Marie",1,0',
      ),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      title: "Résister",
      authors: ["Salomé Saqué"],
      isbn: "9781961108042",
      status: "READ",
      rating: 8, // 4 stars doubled.
      notes: "Lend to Marie\n\nGreat read",
      startedAt: null,
      finishedAt: "2025-03-31T00:00:00.000Z",
      ownershipStatus: "PHYSICAL",
      readCount: 1,
    });
  });

  it("keeps whichever of private notes / review is present, and null when both are empty", () => {
    const rows = parseGoodreadsCsv(
      csv(
        '1,A,X,X,,,,0,0,,,,,,,2025/01/01,to-read,,to-read,,0,"Only private",0,0',
        '2,B,X,X,,,,0,0,,,,,,,2025/01/01,to-read,,to-read,"Only review",0,,0,0',
        "3,C,X,X,,,,0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
      ),
    );

    expect(rows.map((r) => r.notes)).toEqual([
      "Only private",
      "Only review",
      null,
    ]);
  });

  it("derives ownership from Binding alone (Owned Copies is unreliable in practice)", () => {
    const rows = parseGoodreadsCsv(
      csv(
        "1,A,X,X,,,,0,0,,Paperback,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
        "2,B,X,X,,,,0,0,,Kindle Edition,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
        "3,C,X,X,,,,0,0,,ebook,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
        "4,D,X,X,,,,0,0,,Audiobook,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
        "5,E,X,X,,,,0,0,,Hardcover,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
        // Empty binding → NONE, even though this is how Goodreads
        // actually exports "Owned Copies" for nearly every real row.
        "6,F,X,X,,,,0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
      ),
    );

    expect(rows.map((r) => r.ownershipStatus)).toEqual([
      "PHYSICAL",
      "DIGITAL",
      "DIGITAL",
      "AUDIO",
      "PHYSICAL",
      "NONE",
    ]);
  });

  it("maps every default shelf, doubles the star rating, and reads the read count", () => {
    const rows = parseGoodreadsCsv(
      csv(
        "1,A,X,X,,,,0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
        "2,B,X,X,,,,0,0,,,,,,,2025/01/01,currently-reading,,currently-reading,,0,,0,0",
        "3,C,X,X,,,,5,0,,,,,,,2025/01/01,read,,read,,0,,3,0",
      ),
    );

    expect(rows.map((r) => r.status)).toEqual(["TO_READ", "READING", "READ"]);
    expect(rows[2].rating).toBe(10); // 5 stars doubled.
    expect(rows[2].readCount).toBe(3);
    expect(rows[0].rating).toBeNull();
  });

  it('overrides an "abandoned"/"dnf" custom shelf to DROPPED even though Exclusive Shelf stays "read"', () => {
    // Goodreads has no official did-not-finish shelf: users tag the book
    // with a custom one instead, while Exclusive Shelf is forced to one of
    // its 3 built-ins — here "read", the closest bucket to "I stopped".
    const rows = parseGoodreadsCsv(
      csv(
        "1,Ward,Wildbow,X,,,,0,0,,ebook,,,,,2025/01/01,abandoned,abandoned (#1),read,,0,,1,0",
        "2,DNF Book,X,X,,,,0,0,,,,,,,2025/01/01,dnf,,read,,0,,0,0",
        "3,Finished,X,X,,,,0,0,,,,,,,2025/01/01,read,,read,,0,,1,0",
      ),
    );

    expect(rows.map((r) => r.status)).toEqual(["DROPPED", "DROPPED", "READ"]);
  });

  it("combines primary + additional authors and rejects non-ISBN identifiers", () => {
    const rows = parseGoodreadsCsv(
      csv(
        '1,Manifesto,Karl Marx,"Marx, Karl","Friedrich Engels",not-an-isbn,,0,0,,,,,,,2025/01/01,currently-reading,,currently-reading,,0,,0,0',
      ),
    );

    expect(rows[0].authors).toEqual(["Karl Marx", "Friedrich Engels"]);
    expect(rows[0].isbn).toBeNull();
  });

  it("prefers ISBN13 over ISBN when both are present", () => {
    const rows = parseGoodreadsCsv(
      csv(
        "1,A,X,X,,0261102214,9780261102217,0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
      ),
    );

    expect(rows[0].isbn).toBe("9780261102217");
  });

  it("parses every Date Read format found in real exports", () => {
    const rows = parseGoodreadsCsv(
      csv(
        "1,A,X,X,,,,0,0,,,,,,2025/03/31,,to-read,,to-read,,0,,0,0", // YYYY/M/D, zero-padded
        "2,B,X,X,,,,0,0,,,,,,1/1/2018,,to-read,,to-read,,0,,0,0", // M/D/YYYY
        "3,C,X,X,,,,0,0,,,,,,12/26/2018,,to-read,,to-read,,0,,0,0", // MM/DD/YYYY
        "4,D,X,X,,,,0,0,,,,,,7/15/2020,,to-read,,to-read,,0,,0,0", // M/DD/YYYY
        "5,E,X,X,,,,0,0,,,,,,,,to-read,,to-read,,0,,0,0", // absent
      ),
    );

    expect(rows.map((r) => r.finishedAt)).toEqual([
      "2025-03-31T00:00:00.000Z",
      "2018-01-01T00:00:00.000Z",
      "2018-12-26T00:00:00.000Z",
      "2020-07-15T00:00:00.000Z",
      null,
    ]);
  });

  it("skips rows without a title", () => {
    const rows = parseGoodreadsCsv(
      csv("1,,X,,,,,0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0"),
    );
    expect(rows).toHaveLength(0);
  });
});
