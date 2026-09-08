import type { UserDto } from "@loomkeep/shared";
import { liveFlags } from "./feature-flags-live.svelte";

/** Global auth state. Session tokens stay in HttpOnly cookies. */
class AuthState {
  user = $state<UserDto | null>(null);
  /** The real plan (not the `premium-features`-gated effective status) — see `getMyEntitlement`. */
  isPremium = $state(false);

  // $derived (not a plain getter) so effects that read these only re-run when
  // the boolean itself flips — not on every `user` reassignment (e.g. every
  // settings mutation re-sets `auth.user` to a fresh object with the same
  // login/role status). A plain getter re-reads the `user` signal on every
  // access, so an effect depending on it would rerun on those reassignments
  // too, even though its own dependency (this boolean) never changed.
  isLoggedIn = $derived(this.user !== null);

  /** Whether the current user has the ADMIN role (gates /admin). */
  isAdmin = $derived(this.user?.role === "ADMIN");

  /**
   * Whether premium-only UI should render its locked state: the
   * `premium-features` flag is on (the plan is being enforced) and this
   * account isn't premium. Centralized so every gated screen agrees on the
   * same rule instead of recomputing it locally.
   */
  isPremiumLocked = $derived(
    liveFlags.isEnabled("premium-features") && !this.isPremium,
  );

  clear(): void {
    this.user = null;
    this.isPremium = false;
  }
}

export const auth = new AuthState();
