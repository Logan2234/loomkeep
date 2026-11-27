import {
  episodeCode,
  progressPercent,
  type LibraryEntryDto,
} from "@loomkeep/shared/contracts";

export const epCode = (e: { seasonNumber: number; episodeNumber: number }) =>
  episodeCode(e.seasonNumber, e.episodeNumber);

export const mediaHref = (item: { type: string; sourceId: string | number }) =>
  `/app/media/${item.type.toLowerCase()}/${item.sourceId}`;

export function entryPct(e: LibraryEntryDto): number {
  return progressPercent(e.progress);
}
