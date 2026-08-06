import type { ImportSourceDescriptor } from "@loomkeep/shared";

/**
 * The per-source configuration dictionary that drives the generic
 * {@link ImportWizard}. Adding a source is (mostly) a new entry here plus its
 * backend `ImportSource` — the wizard UI itself stays untouched.
 *
 * Free-form export instructions live in each route's `intro` snippet, not here:
 * they are markup (links, formatting), not configuration.
 */
export const IMPORT_SOURCES: Record<string, ImportSourceDescriptor> = {
  tvtime: {
    id: "tvtime",
    label: "TV Time",
    domain: "media",
    input: { type: "zip", accept: ".zip" },
    canOverrideData: true,
    hasManualMatch: true,
    collapsibleGroups: true,
    noun: { one: "titre", many: "titres" },
    libraryHref: "/media",
    options: [
      { key: "importMovies", label: "Inclure les films", default: true },
    ],
  },
  storygraph: {
    id: "storygraph",
    label: "StoryGraph",
    domain: "books",
    input: { type: "csv", accept: ".csv,text/csv" },
    canOverrideData: true,
    hasManualMatch: true,
    collapsibleGroups: true,
    noun: { one: "livre", many: "livres" },
    libraryHref: "/books",
  },
  goodreads: {
    id: "goodreads",
    label: "Goodreads",
    domain: "books",
    input: { type: "csv", accept: ".csv,text/csv" },
    canOverrideData: true,
    hasManualMatch: true,
    collapsibleGroups: true,
    noun: { one: "livre", many: "livres" },
    libraryHref: "/books",
  },
  steam: {
    id: "steam",
    label: "Steam",
    domain: "games",
    input: { type: "steamId" },
    canOverrideData: true,
    hasManualMatch: true,
    collapsibleGroups: true,
    noun: { one: "jeu", many: "jeux" },
    libraryHref: "/games",
  },
};
