import {
  contributorIds,
  foundedPercent,
  medianResolutionHours,
  rankContributors,
  rankReporters,
  type ContributionCounts,
} from "./admin-social-stats.util";

const HOUR = 60 * 60 * 1000;

describe("medianResolutionHours", () => {
  const report = (hours: number) => ({
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    resolvedAt: new Date(
      new Date("2026-07-01T00:00:00.000Z").getTime() + hours * HOUR,
    ),
  });

  it("returns null when nothing is closed", () => {
    expect(medianResolutionHours([])).toBeNull();
  });

  it("takes the middle value on an odd sample", () => {
    expect(medianResolutionHours([report(1), report(4), report(100)])).toBe(4);
  });

  it("averages the two middle values on an even sample", () => {
    expect(
      medianResolutionHours([report(2), report(4), report(6), report(8)]),
    ).toBe(5);
  });

  it("is unmoved by a single very old report", () => {
    const fast = [report(1), report(1), report(2)];
    expect(medianResolutionHours([...fast, report(500)])).toBe(1.5);
  });

  it("rounds to one decimal", () => {
    expect(medianResolutionHours([report(1 / 3)])).toBe(0.3);
  });
});

describe("foundedPercent", () => {
  it("returns null while no report is closed", () => {
    expect(foundedPercent(0, 0)).toBeNull();
  });

  it("counts only closed reports", () => {
    expect(foundedPercent(18, 7)).toBe(72);
  });

  it("reports 100 % when nothing was dismissed", () => {
    expect(foundedPercent(3, 0)).toBe(100);
  });
});

describe("contributorIds / rankContributors", () => {
  const counts: ContributionCounts = {
    reviews: new Map([
      ["u1", 9],
      ["u2", 4],
    ]),
    comments: new Map([
      ["u1", 12],
      ["u3", 6],
    ]),
  };
  const usernames = new Map([
    ["u1", "logan"],
    ["u2", "mira"],
    ["u3", "sacha"],
  ]);

  it("counts an account once even when it wrote on both tables", () => {
    expect(contributorIds(counts)).toEqual(new Set(["u1", "u2", "u3"]));
  });

  it("sums reviews and comments, descending", () => {
    expect(rankContributors(counts, usernames)).toEqual([
      { username: "logan", contributions: 21 },
      { username: "sacha", contributions: 6 },
      { username: "mira", contributions: 4 },
    ]);
  });

  it("breaks ties on the username so the order is stable between refreshes", () => {
    const tied: ContributionCounts = {
      reviews: new Map([
        ["u2", 5],
        ["u3", 5],
      ]),
      comments: new Map(),
    };
    expect(rankContributors(tied, usernames).map((c) => c.username)).toEqual([
      "mira",
      "sacha",
    ]);
  });

  it("drops an account whose username could not be resolved", () => {
    const orphan: ContributionCounts = {
      reviews: new Map([["gone", 99]]),
      comments: new Map(),
    };
    expect(rankContributors(orphan, usernames)).toEqual([]);
  });

  it("honours the limit", () => {
    expect(rankContributors(counts, usernames, 1)).toHaveLength(1);
  });
});

describe("rankReporters", () => {
  const usernames = new Map([
    ["u1", "logan"],
    ["u2", "mira"],
    ["u3", "sacha"],
  ]);

  it("orders accounts by reports filed, most first", () => {
    const counts = new Map([
      ["u1", 2],
      ["u2", 9],
    ]);
    expect(rankReporters(counts, usernames)).toEqual([
      { username: "mira", reports: 9 },
      { username: "logan", reports: 2 },
    ]);
  });

  it("breaks ties on the username so the order is stable between refreshes", () => {
    const counts = new Map([
      ["u3", 4],
      ["u2", 4],
    ]);
    expect(rankReporters(counts, usernames).map((r) => r.username)).toEqual([
      "mira",
      "sacha",
    ]);
  });

  it("drops an account whose username could not be resolved", () => {
    expect(rankReporters(new Map([["gone", 12]]), usernames)).toEqual([]);
  });

  it("honours the limit", () => {
    const counts = new Map([
      ["u1", 3],
      ["u2", 2],
      ["u3", 1],
    ]);
    expect(rankReporters(counts, usernames, 2)).toHaveLength(2);
  });
});
