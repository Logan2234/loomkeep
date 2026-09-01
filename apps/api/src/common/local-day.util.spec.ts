import { localDay, localParts } from "./local-day.util";

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
