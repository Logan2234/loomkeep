import type { GameLanguageDto } from "@loomkeep/shared/contracts";

export type GameLanguageLevel = "full" | "text" | "none";

/**
 * How far a game goes in the viewer's language: voiced, text only (interface
 * or subtitles), or not at all. Every regional variant counts ("fr-CA" for a
 * French viewer). Null when IGDB lists no language at all: nothing to say.
 */
export function gameLanguageLevel(
  languages: GameLanguageDto[],
  locale: string,
): GameLanguageLevel | null {
  if (languages.length === 0) return null;

  const base = locale.split("-")[0].toLowerCase();
  const mine = languages.filter(
    (l) => l.locale.split("-")[0].toLowerCase() === base,
  );
  if (mine.some((l) => l.audio)) return "full";
  if (mine.some((l) => l.interface || l.subtitles)) return "text";
  return "none";
}

/** The viewer's language first, then the rest in IGDB's order. */
export function viewerLanguageFirst(
  languages: GameLanguageDto[],
  locale: string,
): GameLanguageDto[] {
  const base = locale.split("-")[0].toLowerCase();
  const isMine = (l: GameLanguageDto) =>
    l.locale.split("-")[0].toLowerCase() === base;
  return [...languages.filter(isMine), ...languages.filter((l) => !isMine(l))];
}
