import {
  COHORT_MONTHS,
  cohortMonthStarts,
  cohortRetention,
  enabledDomainCountBuckets,
  type CohortUser,
} from "./admin-accounts-stats.util";

describe("cohortMonthStarts", () => {
  it("ends on the current UTC month and walks back COHORT_MONTHS", () => {
    const starts = cohortMonthStarts(new Date("2026-07-15T12:00:00.000Z"));
    expect(starts).toHaveLength(COHORT_MONTHS);
    expect(starts[starts.length - 1].toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
    expect(starts[0].toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("crosses the year edge", () => {
    const starts = cohortMonthStarts(new Date("2026-02-03T00:00:00.000Z"), 4);
    expect(starts.map((s) => s.toISOString())).toEqual([
      "2025-11-01T00:00:00.000Z",
      "2025-12-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    ]);
  });
});

describe("cohortRetention", () => {
  const months = cohortMonthStarts(new Date("2026-04-10T00:00:00.000Z"), 3);
  // → Feb, Mar, Apr 2026

  const user = (
    createdAt: string,
    lastActiveAt: string | null,
  ): CohortUser => ({
    createdAt: new Date(createdAt),
    lastActiveAt: lastActiveAt === null ? null : new Date(lastActiveAt),
  });

  it("groups users by signup month and shrinks the row width per cohort", () => {
    const rows = cohortRetention(
      [
        user("2026-02-05T00:00:00.000Z", "2026-04-02T00:00:00.000Z"),
        user("2026-03-20T00:00:00.000Z", "2026-03-25T00:00:00.000Z"),
        user("2026-04-01T00:00:00.000Z", "2026-04-09T00:00:00.000Z"),
      ],
      months,
    );

    expect(rows.map((r) => r.month)).toEqual(
      months.map((m) => m.toISOString()),
    );
    expect(rows.map((r) => r.size)).toEqual([1, 1, 1]);
    expect(rows.map((r) => r.retention.length)).toEqual([3, 2, 1]);
  });

  it("reads retention as survival: still counted while the last session is later", () => {
    const rows = cohortRetention(
      [
        // Four February accounts, dropping off one month at a time.
        user("2026-02-01T00:00:00.000Z", "2026-02-10T00:00:00.000Z"),
        user("2026-02-02T00:00:00.000Z", "2026-03-10T00:00:00.000Z"),
        user("2026-02-03T00:00:00.000Z", "2026-04-10T00:00:00.000Z"),
        user("2026-02-04T00:00:00.000Z", "2026-04-11T00:00:00.000Z"),
      ],
      months,
    );

    expect(rows[0].retention).toEqual([100, 75, 50]);
  });

  it("counts an account that never opened a session as lost immediately", () => {
    const rows = cohortRetention(
      [
        user("2026-02-01T00:00:00.000Z", null),
        user("2026-02-02T00:00:00.000Z", "2026-04-01T00:00:00.000Z"),
      ],
      months,
    );
    expect(rows[0].retention).toEqual([50, 50, 50]);
  });

  it("returns zeroed rows for an empty cohort", () => {
    const rows = cohortRetention([], months);
    expect(rows[0]).toEqual({
      month: months[0].toISOString(),
      size: 0,
      retention: [0, 0, 0],
    });
  });

  it("ignores users who signed up before the window", () => {
    const rows = cohortRetention(
      [user("2025-12-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z")],
      months,
    );
    expect(rows.every((r) => r.size === 0)).toBe(true);
  });
});

describe("enabledDomainCountBuckets", () => {
  it("counts accounts per number of enabled domains, most common first", () => {
    const out = enabledDomainCountBuckets([
      { enabledDomains: ["MEDIA", "GAMES", "BOOKS"] },
      { enabledDomains: ["MEDIA", "GAMES", "BOOKS"] },
      { enabledDomains: ["MEDIA"] },
      { enabledDomains: ["MEDIA", "MUSIC"] },
    ]);
    expect(out).toEqual([
      { domains: 3, accounts: 2 },
      { domains: 2, accounts: 1 },
      { domains: 1, accounts: 1 },
    ]);
  });

  it("returns nothing when there is no account", () => {
    expect(enabledDomainCountBuckets([])).toEqual([]);
  });
});
