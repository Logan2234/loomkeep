import { formatDate, joinMeta } from "$lib/format";
import { m } from "$lib/paraglide/messages.js";
import type { EntryStatus, SagaMemberDto } from "@loomkeep/shared";

const SEGMENT_COLORS: Record<EntryStatus, string> = {
  COMPLETED: "bg-success",
  UP_TO_DATE: "bg-success",
  WATCHING: "bg-accent",
  PLANNED: "bg-dim/55",
  DROPPED: "bg-danger",
};

/** A saga segment's fill: the work's status, faint when not tracked. */
export const sagaSegmentClass = (x: SagaMemberDto) =>
  x.status
    ? SEGMENT_COLORS[x.status]
    : x.upcoming
      ? "border-border border border-dashed"
      : "bg-surface-2";

export const sagaMemberHref = (x: SagaMemberDto) =>
  `/app/media/${x.type.toLowerCase()}/${x.sourceId}`;

const formats = (): Record<string, string> => ({
  MOVIE: m.media_movie(),
  SPECIAL: m.media_special(),
  TV_SHORT: m.media_short_series(),
});

/** Year · format · episodes, or the release date of an announced work. */
export const sagaMemberMeta = (x: SagaMemberDto) =>
  x.upcoming
    ? m.media_saga_upcoming_on({
        date: x.releaseDate ? formatDate(x.releaseDate) : "—",
      })
    : joinMeta(
        x.year !== null ? String(x.year) : null,
        x.format ? (formats()[x.format] ?? x.format) : null,
        x.episodes ? `${x.episodes} ${m.media_episode_short()}` : null,
      );
