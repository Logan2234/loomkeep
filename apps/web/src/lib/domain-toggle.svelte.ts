import { updateMe } from "$lib/api/client";
import { createApiMutation } from "$lib/api/mutation.svelte";
import { auth } from "$lib/auth.svelte";
import { toggleDomainSelection } from "$lib/domains";
import type { Domain } from "@loomkeep/shared";

/**
 * Shared by the onboarding wizard and the settings tiles: toggling a domain,
 * optimistically.
 *
 * The displayed selection is the source of truth, not `auth.user` as the
 * server last sent it. Computing the next array from the server state lost
 * taps twice over on a slow connection — `createApiMutation` ignores a
 * `mutate()` made while one is in flight, and the state the next tap read was
 * still the pre-request one. Four tiles tapped in a row saved one domain.
 *
 * So a tap applies right away, and the burst's last state is replayed once
 * the in-flight save settles. A failure rolls back to the last selection the
 * server acknowledged.
 */
export function createDomainToggle() {
  let confirmed: Domain[] | null = null;
  let queued: Domain[] | null = null;

  const save = createApiMutation(() => ({
    mutate: (enabledDomains: Domain[]) => updateMe({ enabledDomains }),
    onSuccess: (_user, enabledDomains) => {
      confirmed = enabledDomains;
      // updateMe() just replaced auth.user with the server's copy, which
      // predates whatever was tapped while the request was in flight.
      if (queued && auth.user) auth.user.enabledDomains = queued;
    },
    onError: () => {
      queued = null;
      if (auth.user && confirmed) auth.user.enabledDomains = confirmed;
      confirmed = null;
    },
  }));

  $effect(() => {
    if (save.loading || !queued) return;
    const next = queued;
    queued = null;
    save.mutate(next);
  });

  return {
    get error() {
      return save.error;
    },
    toggle(id: Domain): void {
      const user = auth.user;
      if (!user) return;

      const next = toggleDomainSelection(user.enabledDomains, id);
      if (next === user.enabledDomains) return; // last domain, refused

      confirmed ??= user.enabledDomains;
      user.enabledDomains = next;

      if (save.loading) queued = next;
      else save.mutate(next);
    },
  };
}
