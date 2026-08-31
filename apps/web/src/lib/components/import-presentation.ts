import { ApiError } from "$lib/api/core";
import { resolveApiError } from "$lib/api/errors";
import { formatNumber } from "$lib/format";
import { m } from "$lib/paraglide/messages.js";
import { getLocale } from "$lib/paraglide/runtime.js";
import type {
  ImportJobDto,
  ImportPlanItem,
  ImportReportTile,
} from "@loomkeep/shared";

// Functions read the current locale even when a plan was loaded in another one.
const LABELS = {
  READING: () => m.book_status_reading(),
  TO_READ: () => m.book_status_to_read(),
  READ: () => m.book_status_read(),
  DROPPED: () => m.library_status_dropped(),
  PLAYING: () => m.game_status_playing(),
  BACKLOG: () => m.game_status_backlog(),
  COMPLETED: () => m.library_status_completed(),
  books: () => m.common_Books(),
  games: () => m.common_Games(),
  series: () => m.media_series_plural(),
  movies: () => m.media_movies(),
  episodes: () => m.media_episodes(),
  playtime: () => m.game_playtime(),
  seriesTracked: () => m.import_group_series_tracked(),
  seriesWatchlist: () => m.import_group_series_watchlist(),
  moviesWatched: () => m.import_group_movies_watched(),
  moviesWatchlist: () => m.import_group_movies_watchlist(),
} satisfies Record<
  | NonNullable<ImportReportTile["id"]>
  | "seriesTracked"
  | "seriesWatchlist"
  | "moviesWatched"
  | "moviesWatchlist",
  () => string
>;

function label(id: string | undefined): string | null {
  return id && Object.hasOwn(LABELS, id)
    ? LABELS[id as keyof typeof LABELS]()
    : null;
}

const number = (value: number) => formatNumber(value, {}, getLocale());

export function importGroupLabel(id: string): string {
  return label(id) ?? m.common_other();
}

export function importReportLabel(tile: ImportReportTile): string {
  return label(tile.id) ?? m.common_results();
}

export function importReportSubtitle(tile: ImportReportTile): string | null {
  switch (tile.id) {
    case "series":
    case "movies":
      return tile.watchlistCount === undefined
        ? null
        : m.import_watchlist_count({ count: number(tile.watchlistCount) });
    case "episodes":
      return tile.value === 1
        ? m.import_viewing_created()
        : m.import_viewings_created();
    case "playtime":
      return tile.value === 1
        ? m.import_hour_imported()
        : m.import_hours_imported();
    default:
      return null;
  }
}

export function importItemTitle(item: ImportPlanItem): string {
  return item.context?.kind === "game" && item.context.unknownTitle
    ? m.common_unknown()
    : item.sourceTitle;
}

export function importItemSubtitle(item: ImportPlanItem): string | null {
  const context = item.context;
  // Older APIs only provide French prose: omit it instead of guessing its meaning.
  if (!context) return null;
  const parts: string[] = [];

  switch (context.kind) {
    case "game": {
      const hours = Math.round(context.playtimeMinutes / 60);
      parts.push(
        context.playtimeMinutes === 0
          ? m.game_never_played()
          : `${hours === 0 ? "< 1" : number(hours)} ${m.common_hours_short()}`,
      );
      if (context.recentlyPlayed) parts.push(m.game_played_recently());
      return parts.join(" · ");
    }

    case "series": {
      const count = number(context.episodesWatched);
      parts.push(
        context.episodesWatched === 0
          ? m.library_status_planned()
          : context.episodesWatched === 1
            ? m.import_episode_watched({ count })
            : m.import_episodes_watched({ count }),
      );
      break;
    }

    case "movie":
      if (context.year !== null) parts.push(String(context.year));
      if (context.rewatches > 0)
        parts.push(
          m.import_viewing_count({ count: number(context.rewatches + 1) }),
        );
      break;
  }

  if (context.rating !== null) parts.push(`★ ${number(context.rating)}/10`);
  if ("favorite" in context && context.favorite)
    parts.push(`♥ ${m.common_favorite()}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function importJobError(
  job: Pick<ImportJobDto, "error" | "errorCode">,
): string {
  return job.errorCode
    ? resolveApiError(new ApiError(500, "", job.errorCode))
    : m.import_processing_failed();
}
