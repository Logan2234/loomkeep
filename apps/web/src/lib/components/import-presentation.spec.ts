import { m } from "$lib/paraglide/messages.js";
import { getLocale, overwriteGetLocale } from "$lib/paraglide/runtime.js";
import {
  ErrorCode,
  type ImportItemContext,
  type ImportJobDto,
  type ImportPlanItem,
  type ImportReportTile,
} from "@loomkeep/shared";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  importGroupLabel,
  importItemSubtitle,
  importItemTitle,
  importJobError,
  importReportLabel,
  importReportSubtitle,
} from "./import-presentation";

const previousLocale = getLocale;
afterEach(() => overwriteGetLocale(previousLocale));

function item(context?: ImportItemContext): ImportPlanItem {
  return {
    key: "1",
    title: "Dune",
    sourceTitle: "Dune",
    subtitle: "Texte français hérité",
    context,
    coverUrl: null,
    match: null,
    include: true,
    alreadyInLibrary: false,
    defaultStatus: null,
  };
}

describe("import presentation", () => {
  it.each(["fr", "en"] as const)(
    "localizes group and report labels in %s",
    (locale) => {
      overwriteGetLocale(() => locale);
      expect(importGroupLabel("seriesTracked")).toBe(
        locale === "fr" ? "Séries suivies" : "Tracked series",
      );
      expect(importGroupLabel("READING")).toBe(m.book_status_reading());
      expect(importGroupLabel("PLAYING")).toBe(m.game_status_playing());
      expect(importGroupLabel("futureGroup")).toBe(m.common_other());
      const tile: ImportReportTile = {
        id: "series",
        label: "Séries",
        value: 4,
        sub: "2 en watchlist",
        watchlistCount: 2,
      };
      expect(importReportLabel(tile)).toBe(m.media_series_plural());
      expect(importReportSubtitle(tile)).toBe(
        locale === "fr" ? "2 à voir" : "2 on the watchlist",
      );
      expect(importReportSubtitle({ ...tile, id: "playtime", value: 1 })).toBe(
        locale === "fr" ? "heure importée" : "hour imported",
      );
      expect(importReportSubtitle({ ...tile, id: "playtime", value: 2 })).toBe(
        locale === "fr" ? "heures importées" : "hours imported",
      );
      expect(importReportSubtitle({ ...tile, id: "episodes", value: 1 })).toBe(
        locale === "fr" ? "visionnage créé" : "viewing created",
      );
      expect(importReportSubtitle({ ...tile, id: "episodes", value: 2 })).toBe(
        locale === "fr" ? "visionnages créés" : "viewings created",
      );
    },
  );

  it.each(["fr", "en"] as const)(
    "formats preview data, not legacy prose, in %s",
    (locale) => {
      overwriteGetLocale(() => locale);
      expect(importItemSubtitle(item({ kind: "book", rating: 8.5 }))).toBe(
        locale === "fr" ? "★ 8,5/10" : "★ 8.5/10",
      );
      expect(
        importItemSubtitle(item({ kind: "book", rating: null })),
      ).toBeNull();
      expect(
        importItemSubtitle(
          item({ kind: "game", playtimeMinutes: 0, recentlyPlayed: false }),
        ),
      ).toBe(locale === "fr" ? "Jamais joué" : "Never played");
      expect(
        importItemSubtitle(
          item({ kind: "game", playtimeMinutes: 5, recentlyPlayed: false }),
        ),
      ).toBe("< 1 h");
      expect(
        importItemSubtitle(
          item({ kind: "game", playtimeMinutes: 120, recentlyPlayed: true }),
        ),
      ).toBe(
        locale === "fr" ? "2 h · Joué récemment" : "2 h · Played recently",
      );
      expect(
        importItemSubtitle(
          item({
            kind: "series",
            episodesWatched: 1,
            rating: null,
            favorite: false,
          }),
        ),
      ).toBe(locale === "fr" ? "1 épisode vu" : "1 episode watched");
      expect(
        importItemSubtitle(
          item({
            kind: "series",
            episodesWatched: 2,
            rating: null,
            favorite: false,
          }),
        ),
      ).toBe(locale === "fr" ? "2 épisodes vus" : "2 episodes watched");
      expect(
        importItemSubtitle(
          item({
            kind: "series",
            episodesWatched: 0,
            rating: null,
            favorite: false,
          }),
        ),
      ).toBe(m.library_status_planned());
      expect(
        importItemSubtitle(
          item({
            kind: "movie",
            year: 2024,
            rewatches: 2,
            rating: 8.5,
            favorite: true,
          }),
        ),
      ).toBe(
        locale === "fr"
          ? "2024 · vu 3 fois · ★ 8,5/10 · ♥ Favori"
          : "2024 · watched 3 times · ★ 8.5/10 · ♥ Favorite",
      );
      expect(importItemTitle(item())).toBe("Dune");
      expect(
        importItemTitle(
          item({
            kind: "game",
            playtimeMinutes: 0,
            recentlyPlayed: false,
            unknownTitle: true,
          }),
        ),
      ).toBe(m.common_unknown());
    },
  );

  it("never displays unlocalized legacy fields or unknown error diagnostics", () => {
    overwriteGetLocale(() => "en");
    expect(importItemSubtitle(item())).toBeNull();
    const tile = { label: "Libellé hérité", value: 1, sub: "Détail hérité" };
    expect(importReportLabel(tile)).toBe(m.common_results());
    expect(importReportSubtitle(tile)).toBeNull();
    const job = {
      error: "Raw provider diagnostic",
      errorCode: ErrorCode.ImportSteamLibraryPrivate,
    };
    expect(importJobError(job)).toBe(m.apierr_import_steam_library_private());
    expect(importJobError({ error: "Texte hérité" })).toBe(
      m.import_processing_failed(),
    );
    expect(
      importJobError({
        error: null,
        errorCode: "future.code" as ImportJobDto["errorCode"],
      }),
    ).toBe(m.apierr_status_500());
  });

  it("routes rendered API text through the presentation helpers", () => {
    const source = readFileSync(
      new URL("./ImportWizard.svelte", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /\{(?:g\.label|tile\.(?:label|sub)|item\.subtitle)\}/,
    );
    expect(source).not.toContain("error = j.error");
    expect(source).not.toContain("{r.type}");

    for (const helper of [
      "importGroupLabel",
      "importItemSubtitle",
      "importItemTitle",
      "importReportLabel",
      "importReportSubtitle",
      "importJobError",
    ]) {
      expect(source).toContain(`${helper}(`);
    }
  });
});
