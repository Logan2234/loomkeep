import type { StatsStatusBucket } from "@loomkeep/shared/contracts";
import type { Domain, ReviewTargetType } from "@loomkeep/shared/enums";

/** The domains with their own tables; PODCASTS and BOARDGAMES have none yet. */
export type TrackedDomain = Extract<
  Domain,
  "MEDIA" | "GAMES" | "BOOKS" | "MUSIC"
>;

/** One library entry, domain-agnostic, for the cross-domain aggregators. */
export interface LibraryRow {
  bucket: StatsStatusBucket;
  favorite: boolean;
  ownershipStatus: string;
  releaseDate: Date | null;
  itemId: string;
  title: string;
  imageUrl: string | null;
  /** Web route of the work, without the `/app` prefix. */
  href: string;
}

/**
 * What a module that reads every domain at once asks of one domain, so it
 * iterates `DomainRegistry` (library/) instead of naming four tables. Each
 * domain module provides its own, next to the tables it owns. A behaviour
 * that only one cross-domain module needs stays in that module.
 */
export interface DomainAdapter<D extends TrackedDomain = TrackedDomain> {
  readonly domain: D;
  /** How reviews, comments and reports name this domain's works. */
  readonly reviewTargetType: ReviewTargetType;

  /** Entries the user tracks, hidden domain or not. */
  countEntries(userId: string): Promise<number>;

  /** Every entry of the user, as the stats overview reads it. */
  libraryRows(userId: string): Promise<LibraryRow[]>;

  /** Titles of the cached works with these ids; unknown ids are absent. */
  itemTitles(ids: string[]): Promise<Map<string, string>>;

  /** This domain's keys of the account export (`GET /users/me/export`). */
  exportEntries(userId: string): Promise<object>;

  /** This domain's CSV export, one row per entry. */
  exportCsv(userId: string): Promise<string>;
}
