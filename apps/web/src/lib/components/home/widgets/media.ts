import type { LibraryEntryDto } from "@loomkeep/shared";

export const epCode = (e: { seasonNumber: number; episodeNumber: number }) =>
  `S${String(e.seasonNumber).padStart(2, "0")}E${String(e.episodeNumber).padStart(2, "0")}`;

export const mediaHref = (item: { type: string; sourceId: string | number }) =>
  `/app/media/${item.type.toLowerCase()}/${item.sourceId}`;

export function entryPct(e: LibraryEntryDto): number {
  if (!e.progress || e.progress.totalEpisodes === 0) return 0;
  return Math.round(
    (e.progress.watchedEpisodes / e.progress.totalEpisodes) * 100,
  );
}
