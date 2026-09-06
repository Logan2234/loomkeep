import { Domain, VisibilityFacet } from "@loomkeep/shared";

/**
 * Content domains that actually back a library (and thus a visibility matrix).
 * Excludes parked and placeholder domains, even when historical rows remain.
 */
export const SOCIAL_DOMAINS: Domain[] = [
  Domain.MEDIA,
  Domain.GAMES,
  Domain.BOOKS,
];

/** The passive-content facets a user tunes per domain. */
export const SOCIAL_FACETS: VisibilityFacet[] = [
  VisibilityFacet.LIBRARY,
  VisibilityFacet.ACTIVITY,
];
