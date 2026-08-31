import { describe, expect, it } from "vitest";
import { createManifest } from "./pwa-manifest";

describe("localized PWA manifest", () => {
  it("translates descriptions and shortcuts", () => {
    const en = createManifest("en");
    const fr = createManifest("fr");
    expect(en.lang).toBe("en");
    expect(fr.lang).toBe("fr");
    expect(en.description).toBe(
      "Self-hosted tracker for series, movies and anime",
    );
    expect(fr.description).toBe("Suivi auto-hébergé de séries, films et anime");
    expect(en.shortcuts.map((shortcut) => shortcut.name)).toEqual([
      "Search",
      "Calendar",
      "Stats",
      "My profile",
      "Settings",
    ]);
    expect(fr.shortcuts.map((shortcut) => shortcut.name)).toEqual([
      "Recherche",
      "Calendrier",
      "Statistiques",
      "Mon profil",
      "Paramètres",
    ]);
  });

  it("keeps installation identity, launch URL and icons independent of locale", () => {
    const en = createManifest("en");
    const fr = createManifest("fr");
    expect(en.id).toBe("/");
    expect(en.id).toBe(fr.id);
    expect(en.start_url).toBe("/app");
    expect(en.start_url).toBe(fr.start_url);
    expect(en.icons).toEqual(fr.icons);
    expect(en.shortcuts.map((shortcut) => shortcut.url)).toEqual(
      fr.shortcuts.map((shortcut) => shortcut.url),
    );
  });
});
