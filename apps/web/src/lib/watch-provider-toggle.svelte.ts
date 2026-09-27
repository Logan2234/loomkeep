import { updateMe } from "$lib/api/client";
import { createApiMutation } from "$lib/api/mutation.svelte";
import { auth } from "$lib/auth.svelte";

/**
 * Adds or removes one of the user's streaming services, optimistically —
 * same mechanics as `createDomainToggle()`, for the same reason: a burst of
 * taps on the settings grid must not lose any to the save in flight.
 */
export function createWatchProviderToggle() {
  let confirmed: number[] | null = null;
  let queued: number[] | null = null;

  const save = createApiMutation(() => ({
    mutate: (watchProviderIds: number[]) => updateMe({ watchProviderIds }),
    onSuccess: (_user, watchProviderIds) => {
      confirmed = watchProviderIds;
      if (queued && auth.user) auth.user.watchProviderIds = queued;
    },
    onError: () => {
      queued = null;
      if (auth.user && confirmed) auth.user.watchProviderIds = confirmed;
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
    get saving() {
      return save.loading;
    },
    toggle(id: number): void {
      const user = auth.user;
      if (!user) return;

      const current = user.watchProviderIds;
      const next = current.includes(id)
        ? current.filter((picked) => picked !== id)
        : [...current, id];

      confirmed ??= current;
      user.watchProviderIds = next;

      if (save.loading) queued = next;
      else save.mutate(next);
    },
  };
}
