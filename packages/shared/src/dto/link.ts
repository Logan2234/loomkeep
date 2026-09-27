import type { Domain } from "../enums";

/** The Loomkeep page a catalogue link (TMDB, IMDb, Steam…) points to. */
export interface ResolvedLinkDto {
  /** Null for a Loomkeep page that isn't a work (a profile, a list…). */
  domain: Domain | null;
  /** Client route, e.g. "/app/media/movie/603". */
  href: string;
}

export interface ResolveLinkResultDto {
  /** Null when the link isn't one Loomkeep knows how to read. */
  match: ResolvedLinkDto | null;
}
