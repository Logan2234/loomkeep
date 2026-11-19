import type { CalendarEntryDto, PremiereDto } from "@loomkeep/shared";
import { buildCalendarIcs, buildPremieresIcs } from "./ics.util";

function entry(overrides: Partial<CalendarEntryDto> = {}): CalendarEntryDto {
  return {
    mediaItem: {
      id: "media-1",
      type: "SERIES",
      title: "Severance",
      posterUrl: null,
      canonicalSource: "TMDB",
      sourceId: "12345",
    },
    game: null,
    entryId: "entry-1",
    episodeAlertsMuted: false,
    episodesBehind: 0,
    seasonNumber: 2,
    episodeNumber: 3,
    episodeTitle: null,
    airDate: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildCalendarIcs", () => {
  it("renders a local movie release with a stable UID and no episode code", () => {
    const movie = entry({
      seasonNumber: null,
      episodeNumber: null,
      releaseRegion: "FR",
      releaseType: "cinema",
    });
    movie.mediaItem!.type = "MOVIE";
    const ics = buildCalendarIcs([movie]);
    expect(ics).toContain("SUMMARY:Severance\r\n");
    expect(ics).toContain("UID:media-1-movie-FR@loomkeep.app");
    expect(ics).not.toContain("SnullEnull");
  });
  it("wraps an empty feed in a valid VCALENDAR", () => {
    const ics = buildCalendarIcs([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("renders one all-day VEVENT per entry with season/episode code", () => {
    const ics = buildCalendarIcs([entry()]);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Severance S02E03");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260815");
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("includes the episode title as DESCRIPTION when present", () => {
    const ics = buildCalendarIcs([entry({ episodeTitle: "Cold Harbor" })]);
    expect(ics).toContain("DESCRIPTION:Cold Harbor");
  });

  it("spans the whole month for a game dated to one", () => {
    const ics = buildCalendarIcs([
      entry({
        mediaItem: null,
        game: {
          id: "game-1",
          title: "Kingdom Hearts IV",
          coverUrl: null,
          canonicalSource: "IGDB",
          sourceId: "113112",
        },
        seasonNumber: null,
        episodeNumber: null,
        releasePrecision: "MONTH",
        airDate: "2026-11-01T00:00:00.000Z",
      }),
    ]);
    expect(ics).toContain("UID:game-1-game@loomkeep.app");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261101");
    expect(ics).toContain("DTEND;VALUE=DATE:20261201");
    expect(ics).toContain("SUMMARY:Kingdom Hearts IV");
  });

  it("escapes commas, semicolons and backslashes in text fields", () => {
    const ics = buildCalendarIcs([
      entry({ mediaItem: { ...entry().mediaItem!, title: "Foo; Bar, Baz\\" } }),
    ]);
    expect(ics).toContain("SUMMARY:Foo\\; Bar\\, Baz\\\\ S02E03");
  });

  it("uses a stable UID per media item/season/episode so re-fetching doesn't duplicate events", () => {
    const ics1 = buildCalendarIcs([entry()]);
    const ics2 = buildCalendarIcs([entry()]);
    const uid = /UID:([^\r\n]+)/.exec(ics1)?.[1];
    expect(uid).toBe(/UID:([^\r\n]+)/.exec(ics2)?.[1]);
  });

  it("uses CRLF line endings", () => {
    const ics = buildCalendarIcs([entry()]);
    expect(ics.includes("\r\n")).toBe(true);
    expect(
      ics.split("\n").every((line) => line === "" || line.endsWith("\r")),
    ).toBe(true);
  });
});

describe("buildPremieresIcs", () => {
  const premiere: PremiereDto = {
    sourceId: "171802",
    title: "Blade Runner 2099",
    originalTitle: null,
    firstAirDate: "2026-11-25",
    networkId: 1024,
    networkName: "Prime Video",
    originCountries: ["US"],
    overview: "Los Angeles, 2099.",
    posterUrl: "https://image.tmdb.org/t/p/w500/p.jpg",
    backdropUrl: null,
    popularity: 10,
  };

  it("renders a premiere as an all-day event with its network and series link", () => {
    const ics = buildPremieresIcs([premiere], {
      name: "Loomkeep · Premières",
      webOrigin: "https://loomkeep.app",
    });

    expect(ics).toContain("X-WR-CALNAME:Loomkeep · Premières");
    expect(ics).toContain("UID:171802-premiere@loomkeep.app");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261125");
    expect(ics).toContain("SUMMARY:Blade Runner 2099 (Prime Video)");
    expect(ics).toContain("URL:https://loomkeep.app/app/media/series/171802");
    expect(ics).toContain("DESCRIPTION:Los Angeles\\, 2099.");
  });

  it("leaves the description out when TMDB has no synopsis", () => {
    const ics = buildPremieresIcs([{ ...premiere, overview: null }], {
      name: "Loomkeep",
      webOrigin: "https://loomkeep.app",
    });

    expect(ics).not.toContain("DESCRIPTION");
  });
});
