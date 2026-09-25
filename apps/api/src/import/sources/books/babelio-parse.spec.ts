import { parseBabelioCsv } from "./babelio-parse";

const HEADER =
  '"ISBN";"Titre";"Auteur";"Editeur";"Date de publication";"Date d`entrée dans Babelio";"Statut";"Note"';

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseBabelioCsv", () => {
  it("parses the official semicolon-delimited export by ISBN", () => {
    const rows = parseBabelioCsv(
      csv(
        '"9782729119225";"RUR; Rossum\'s Universal Robots";"Čapek Karel";"Editions de La Différence";"2011-02-17";"2013-07-02 22:12:45";"Lu";"4"',
      ),
    );

    expect(rows).toEqual([
      {
        title: "RUR; Rossum's Universal Robots",
        authors: ["Čapek Karel"],
        isbn: "9782729119225",
        status: "READ",
        rating: 8,
        notes: null,
        startedAt: null,
        finishedAt: null,
        ownershipStatus: "NONE",
        readCount: 0,
      },
    ]);
  });

  it("maps every known Babelio shelf and keeps unknown shelves importable", () => {
    const rows = parseBabelioCsv(
      csv(
        '"";"Reading";"A";"";"";"";"En cours";"0"',
        '"";"Wishlist";"A";"";"";"";"Pense-bête";""',
        '"";"Stopped";"A";"";"";"";"Abandonné";""',
        '"";"Other";"A";"";"";"";"Custom shelf";""',
      ),
    );

    expect(rows.map((row) => row.status)).toEqual([
      "READING",
      "TO_READ",
      "DROPPED",
      "TO_READ",
    ]);
    expect(rows.map((row) => row.rating)).toEqual([null, null, null, null]);
  });

  it("rejects malformed ISBNs and skips empty titles", () => {
    const rows = parseBabelioCsv(
      csv(
        '"invalid";"Untitled ISBN";"A";"";"";"";"À lire";""',
        '"978-2-07-036822-8";"Valid ISBN";"A";"";"";"";"À lire";""',
        '"9782729119225";"";"A";"";"";"";"Lu";"5"',
      ),
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.isbn)).toEqual([null, "9782070368228"]);
  });
});
