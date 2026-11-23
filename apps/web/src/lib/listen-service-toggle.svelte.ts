import { updateMe } from "#lib/api/client.js";
import { createApiMutation } from "#lib/api/mutation.svelte.js";
import { auth } from "#lib/auth.svelte.js";
import { LISTEN_SERVICES, type ListenService } from "@loomkeep/shared";

/**
 * Adds or removes one of the user's music services, optimistically: same
 * mechanics as `createWatchProviderToggle()`, so a burst of taps on the
 * settings grid loses none to the save in flight.
 */
export function createListenServiceToggle() {
  let confirmed: ListenService[] | null = null;
  let queued: ListenService[] | null = null;

  const save = createApiMutation(() => ({
    mutate: (listenServices: ListenService[]) => updateMe({ listenServices }),
    onSuccess: (_user, listenServices) => {
      confirmed = listenServices;
      if (queued && auth.user) auth.user.listenServices = queued;
    },
    onError: () => {
      queued = null;
      if (auth.user && confirmed) auth.user.listenServices = confirmed;
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
    toggle(service: ListenService): void {
      const user = auth.user;
      if (!user) return;

      const current = user.listenServices;
      // Kept in display order, so the album page reads it as is.
      const next = LISTEN_SERVICES.filter((s) =>
        s === service ? !current.includes(s) : current.includes(s),
      );

      confirmed ??= current;
      user.listenServices = next;

      if (save.loading) queued = next;
      else save.mutate(next);
    },
  };
}
