import { m } from "$lib/paraglide/messages.js";
import type { CalendarEntryDto } from "@loomkeep/shared";
import { episodeCode } from "@loomkeep/shared";

// A calendar entry holds either a show/movie or a game; these read it whichever.

export const calendarTitle = (e: CalendarEntryDto) =>
  e.game?.title ?? e.mediaItem?.title ?? "";

export const calendarPoster = (e: CalendarEntryDto) =>
  e.game?.coverUrl ?? e.mediaItem?.posterUrl ?? null;

export const calendarItemId = (e: CalendarEntryDto) =>
  e.game?.id ?? e.mediaItem?.id ?? "";

export const calendarHref = (e: CalendarEntryDto) =>
  e.game
    ? `/app/games/${e.game.sourceId}`
    : `/app/media/${e.mediaItem?.type.toLowerCase()}/${e.mediaItem?.sourceId}`;

/** A movie or a game: a release the user opts into, not a show's episodes. */
export const isReleaseReminder = (e: CalendarEntryDto) =>
  !!e.game || e.mediaItem?.type === "MOVIE";

/**
 * The local `YYYY-MM-DD…` to read the entry's day from: a release carries a
 * date without a time, read as local midnight rather than shifted from UTC.
 */
export const calendarDayIso = (e: CalendarEntryDto) =>
  isReleaseReminder(e) ? `${e.airDate.slice(0, 10)}T00:00:00` : e.airDate;

/** "S01E02", "Au cinéma · FR", "Sortie prévue ce mois-ci"… */
export function calendarCode(e: CalendarEntryDto): string {
  if (e.game)
    return e.releasePrecision === "MONTH"
      ? m.calendar_game_this_month()
      : m.calendar_game_release();
  if (e.mediaItem?.type === "MOVIE")
    return `${e.releaseType === "cinema" ? m.media_release_cinema() : m.media_release_digital()} · ${e.releaseRegion}`;
  return episodeCode(e.seasonNumber, e.episodeNumber);
}
