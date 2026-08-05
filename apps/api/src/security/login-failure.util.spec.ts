import { rankFailedTargets, sinceDaysAgo } from "./login-failure.util";

describe("sinceDaysAgo", () => {
  const now = new Date("2026-08-05T12:00:00.000Z");

  it("walks back whole days from the reference instant", () => {
    expect(sinceDaysAgo(now, 1).toISOString()).toBe("2026-08-04T12:00:00.000Z");
    expect(sinceDaysAgo(now, 7).toISOString()).toBe("2026-07-29T12:00:00.000Z");
  });

  it("returns the reference instant itself for a zero-day window", () => {
    expect(sinceDaysAgo(now, 0).getTime()).toBe(now.getTime());
  });
});

describe("rankFailedTargets", () => {
  const rows = [
    { identifier: "mira@example.com", failures: 3 },
    { identifier: "logan@example.com", failures: 12 },
    { identifier: "sacha@example.com", failures: 3 },
  ];

  it("orders by failures, most first", () => {
    expect(rankFailedTargets(rows).map((r) => r.identifier)).toEqual([
      "logan@example.com",
      "mira@example.com",
      "sacha@example.com",
    ]);
  });

  it("honours the limit", () => {
    expect(rankFailedTargets(rows, 1)).toEqual([
      { identifier: "logan@example.com", failures: 12 },
    ]);
  });

  it("leaves the caller's array untouched", () => {
    rankFailedTargets(rows);
    expect(rows[0].identifier).toBe("mira@example.com");
  });

  it("stays empty when nothing failed", () => {
    expect(rankFailedTargets([])).toEqual([]);
  });
});
