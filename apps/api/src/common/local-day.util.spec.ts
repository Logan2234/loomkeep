import {
  localDay,
  localDayOrUtc,
  localParts,
  localYearRange,
  startOfLocalDay,
} from "./local-day.util";

describe("localDayOrUtc", () => {
  it("keeps the local day and falls back to UTC only for an invalid zone", () => {
    const date = new Date("2026-09-01T23:00:00Z");
    expect(localDayOrUtc("Europe/Paris", date)).toBe("2026-09-02");
    expect(localDayOrUtc("Not/AZone", date)).toBe("2026-09-01");
  });
});

describe("localParts", () => {
  it("returns the local hour and weekday for a valid IANA zone", () => {
    // 2026-09-01T18:30:00Z is 20:30 in Paris (UTC+2 in September), a Tuesday.
    const result = localParts("Europe/Paris", new Date("2026-09-01T18:30:00Z"));
    expect(result).toEqual({ hour: 20, weekday: "Tue" });
  });

  it("returns null for an invalid timezone", () => {
    expect(localParts("Not/AZone", new Date())).toBeNull();
  });

  it("never returns hour 24 at local midnight (ICU hour12:false quirk)", () => {
    // 2026-09-01T22:00:00Z is exactly 00:00 in Europe/Paris (UTC+2).
    const result = localParts("Europe/Paris", new Date("2026-09-01T22:00:00Z"));
    expect(result?.hour).toBe(0);
  });
});

describe("localDay", () => {
  it("returns the local calendar day for a valid IANA zone", () => {
    expect(localDay("Europe/Paris", new Date("2026-09-01T18:30:00Z"))).toBe(
      "2026-09-01",
    );
  });

  it("returns null for an invalid timezone", () => {
    expect(localDay("Not/AZone", new Date())).toBeNull();
  });

  it("crosses midnight in a non-UTC timezone ahead of UTC", () => {
    // 2026-09-01T23:00:00Z is 2026-09-02T09:00 in Pacific/Kiritimati (UTC+14).
    expect(
      localDay("Pacific/Kiritimati", new Date("2026-09-01T23:00:00Z")),
    ).toBe("2026-09-02");
  });

  it("crosses midnight in a non-UTC timezone behind UTC", () => {
    // 2026-09-01T02:00:00Z is 2026-08-31T18:00 in America/Los_Angeles (UTC-8 in September... UTC-7 DST).
    expect(
      localDay("America/Los_Angeles", new Date("2026-09-01T02:00:00Z")),
    ).toBe("2026-08-31");
  });
});

describe("startOfLocalDay", () => {
  it("starts the day at local midnight, wherever UTC is", () => {
    // 00:30 in Paris (UTC+1) is already the 15th there, still the 14th in UTC.
    expect(
      startOfLocalDay("Europe/Paris", new Date("2026-11-14T23:30:00Z")),
    ).toEqual(new Date("2026-11-14T23:00:00Z"));
    // 20:00 in Los Angeles (UTC-8) is the 14th there, already the 15th in UTC.
    expect(
      startOfLocalDay("America/Los_Angeles", new Date("2026-11-15T04:00:00Z")),
    ).toEqual(new Date("2026-11-14T08:00:00Z"));
  });

  it("follows a daylight-saving change on the day itself", () => {
    // Paris moves to UTC+2 at 01:00 UTC on 2026-03-29: that day still began
    // at UTC+1 midnight.
    expect(
      startOfLocalDay("Europe/Paris", new Date("2026-03-29T12:00:00Z")),
    ).toEqual(new Date("2026-03-28T23:00:00Z"));
  });

  it("falls back to UTC midnight for an invalid zone", () => {
    expect(
      startOfLocalDay("Not/AZone", new Date("2026-11-14T22:30:00Z")),
    ).toEqual(new Date("2026-11-14T00:00:00Z"));
  });
});

describe("localYearRange", () => {
  it("runs from the user's own new year to the next", () => {
    expect(localYearRange("Europe/Paris", 2027)).toEqual({
      gte: new Date("2026-12-31T23:00:00.000Z"),
      lt: new Date("2027-12-31T23:00:00.000Z"),
    });
  });

  it("falls back to the UTC year for an invalid zone", () => {
    expect(localYearRange("Not/AZone", 2027)).toEqual({
      gte: new Date("2027-01-01T00:00:00.000Z"),
      lt: new Date("2028-01-01T00:00:00.000Z"),
    });
  });
});
