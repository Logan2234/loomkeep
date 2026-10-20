import { auth } from "#lib/auth.svelte.js";
import { SpoilerSensitivity } from "@loomkeep/shared";

/**
 * Whether a discussion opens with its spoilers shown: the member's explicit
 * preference wins over the per-item "already finished this" default, which
 * AUTO leaves as-is.
 */
export function revealSpoilersOnOpen(finished: boolean): boolean {
  switch (auth.user?.spoilerSensitivity) {
    case SpoilerSensitivity.ALWAYS_REVEALED:
      return true;
    case SpoilerSensitivity.ALWAYS_HIDDEN:
      return false;
    default:
      return finished;
  }
}
