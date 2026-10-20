import { FeatureFlag, type UserDto } from "@loomkeep/shared";
import { liveFlags } from "./feature-flags-live.svelte";
import { queryClient } from "./query-client";

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
    liveFlags.isEnabled(FeatureFlag.PREMIUM_FEATURES) && !this.isPremium,
  );

  /**
   * Forgets the signed-in account — on sign-out, and when the session turns
   * out to be dead. The query cache goes with it: its keys don't carry the
   * account, so whoever signs in next in this tab would otherwise be served
   * the previous account's library, stats and messages from cache (fresh for
   * `staleTime`, so not even refetched) until each query went stale.
   */
  clear(): void {
    this.user = null;
    this.isPremium = false;
    queryClient.clear();
  }
}

export const auth = new AuthState();
