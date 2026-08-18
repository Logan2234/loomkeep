// Shared fetch/loading/error resource for /stats detail sections. Each
// domain section (Book/Game/Video/VideoTemporal/Music/Social) used to
// hand-roll this exact $state trio + $effect block; `fetcher` may read
// reactive props/state synchronously (e.g. a period prop) to stay
// re-triggerable, same as the $effect it replaces.
import { ApiError } from "$lib/api/core";

export function statsResource<T>(
  fetcher: () => Promise<T>,
  fallbackError: string,
) {
  let data = $state<T | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    error = null;
    fetcher()
      .then((v) => (data = v))
      .catch((e) => {
        error = e instanceof ApiError ? e.message : fallbackError;
      });
  });

  return {
    get data() {
      return data;
    },
    get error() {
      return error;
    },
  };
}
