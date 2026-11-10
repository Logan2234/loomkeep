import type { CreatorWorkDto } from "@loomkeep/shared";

export type WorkTypeFilter = "ALL" | "MOVIE" | "SERIES";
export type WorkOrder = "newest" | "oldest";

export interface WorkFilters {
  type: WorkTypeFilter;
  /** Only the works in the viewer's library. */
  inLibrary: boolean;
  order: WorkOrder;
}

/**
 * A group's works as the grid shows them. The API sends them oldest first,
 * undated announcements last: newest first is that order reversed, the
 * announcements leading.
 */
export function visibleWorks(
  works: CreatorWorkDto[],
  filters: WorkFilters,
): CreatorWorkDto[] {
  const kept = works.filter(
    (work) =>
      (filters.type === "ALL" || work.type === filters.type) &&
      (!filters.inLibrary || work.status !== null),
  );
  return filters.order === "newest" ? kept.reverse() : kept;
}

/** Whether the type filter has anything to choose between. */
export const mixesTypes = (works: CreatorWorkDto[]) =>
  new Set(works.map((work) => work.type)).size > 1;

// TMDB credits an appearance as oneself with these English words, whatever
// the requested language.
const SELF = /^(self|himself|herself|themselves)$/i;

export const isSelfAppearance = (character: string | null) =>
  !!character && SELF.test(character.trim());

/** "1967", or "1929 – 2018": the years a person lived. */
export function lifeYears(
  birthday: string | null,
  deathday: string | null,
): string | null {
  const born = birthday?.slice(0, 4);
  const died = deathday?.slice(0, 4);
  if (!born) return died ? `† ${died}` : null;
  return died ? `${born} – ${died}` : born;
}
