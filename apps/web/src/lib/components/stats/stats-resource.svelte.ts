// Shared fetch/loading/error resource for /stats detail sections. Each
// domain section (Book/Game/Video/VideoTemporal/Music/Social) used to
// hand-roll this exact $state trio + $effect block; `fetcher` may read
// reactive props/state synchronously (e.g. a period prop) to stay
// re-triggerable, same as the $effect it replaces.
import { resolveApiError } from "$lib/api/errors";

export function statsResource<T>(fetcher: () => Promise<T>) {
  let data = $state<T | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    error = null;
    fetcher()
      .then((v) => (data = v))
      .catch((e) => {
        error = resolveApiError(e);
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
