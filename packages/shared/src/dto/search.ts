import type { Domain } from "../enums";
import type { MessageWorkKind } from "./chat";

/** A work `GET /search/works` found, on the instance or in a catalogue. */
export interface WorkSearchHitDto {
  kind: MessageWorkKind;
  title: string;
  imageUrl: string | null;
  /** Client route to the work's page. */
  href: string;
  year: number | null;
  isAdult: boolean;
  /** The viewer's library status for it; null when they don't track it. */
  status: string | null;
}

export interface WorkSearchResultDto {
  /** Best match first, every enabled domain mixed. */
  items: WorkSearchHitDto[];
  /**
   * Enabled domains whose catalogue didn't answer, or not in time: some of
   * their works may be missing.
   */
  unavailable: Domain[];
}
