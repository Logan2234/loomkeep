import { parseStoryGraphCsv } from "./storygraph-parse";

const HEADER =
  "Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseStoryGraphCsv", () => {
  it("maps a finished, rated book with a date range", () => {
    const rows = parseStoryGraphCsv(
      csv(
        'Résister,Salomé Saqué,"",9782228937597,paperback,read,2025/07/23,2025/03/31,2025/02/01-2025/03/31,1,"informative",fast,,,,,,4.0,"Great read","","","",Yes',
      ),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      title: "Résister",
      authors: ["Salomé Saqué"],
      isbn: "9782228937597",
      status: "READ",
      rating: 8, // 4.0 stars doubled.
      notes: "Great read",
      startedAt: "2025-02-01T00:00:00.000Z",
      finishedAt: "2025-03-31T00:00:00.000Z",
      ownershipStatus: "PHYSICAL",
      readCount: 1,
    });
  });

  it("derives ownership from Format + Owned?, and reads the read count", () => {
    const rows = parseStoryGraphCsv(
      csv(
        'A,X,"",,paperback,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
        'B,X,"",,digital,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
        'C,X,"",,audiobook,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
        'D,X,"",,hardcover,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",No',
        'E,X,"",,,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
        'F,X,"",,paperback,read,2025/01/01,"","",3,"",,,,,,,,"","","","",Yes',
      ),
    );

    expect(rows.map((r) => r.ownershipStatus)).toEqual([
      "PHYSICAL",
      "DIGITAL",
      "AUDIO",
      "BORROWED",
      "NONE",
      "PHYSICAL",
    ]);
    expect(rows.map((r) => r.readCount)).toEqual([0, 0, 0, 0, 0, 3]);
  });

  it("maps every StoryGraph read status and doubles quarter-star ratings", () => {
    const rows = parseStoryGraphCsv(
      csv(
        'A,X,"",,digital,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
        'B,X,"",,digital,currently-reading,2025/01/01,"","",0,"",,,,,,,,"","","","",No',
        'C,X,"",,digital,did-not-finish,2025/01/01,"","",0,"",,,,,,,4.25,"","","","",Yes',
      ),
    );

    expect(rows.map((r) => r.status)).toEqual([
      "TO_READ",
      "READING",
      "DROPPED",
    ]);
    expect(rows[2].rating).toBe(8.5); // 4.25 stars doubled.
    expect(rows[0].rating).toBeNull();
  });

  it("splits multiple authors and rejects non-ISBN identifiers", () => {
    const rows = parseStoryGraphCsv(
      csv(
        'Manifesto,"Karl Marx, Friedrich Engels","",not-an-isbn,paperback,currently-reading,2026/02/06,"","",0,"",,,,,,,,"","","","",No',
      ),
    );

    expect(rows[0].authors).toEqual(["Karl Marx", "Friedrich Engels"]);
    expect(rows[0].isbn).toBeNull();
  });

  it("skips rows without a title", () => {
    const rows = parseStoryGraphCsv(
      csv(
        ',X,"",,digital,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
      ),
    );
    expect(rows).toHaveLength(0);
  });
});
