import { auth } from "#lib/auth.svelte.js";
import { layout } from "#lib/layout.svelte.js";
import { toast } from "#lib/toast.svelte.js";
import * as env from "$app/env/public";

/**
 * The instance's feedback board (Quackback). Unset — a self-hosted instance,
 * by default — means no feedback launcher at all, and no third-party script
 * loaded.
 */
export const feedbackBoardUrl =
  env.PUBLIC_QUACKBACK_URL?.replace(/\/$/, "") || null;

/** Whether the feedback launcher belongs in the corner for this account. */
export function feedbackLauncherWanted(): boolean {
  return (
    !!feedbackBoardUrl && auth.isLoggedIn && auth.user?.feedbackWidget !== false
  );
}

/**
 * The bottom-right launchers (feedback, then Messages beside it) step aside
 * together: the compact shell has no free corner beside its tab bar, and side
 * panels and toasts sit in that same corner.
 */
export function cornerLaunchersHidden(): boolean {
  return layout.compact || layout.openSidePanels > 0 || toast.items.length > 0;
}
