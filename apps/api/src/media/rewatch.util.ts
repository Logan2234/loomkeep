/**
 * The episode to watch next while rewatching a show: the one right after the
 * last episode seen again, so a skipped episode doesn't pull the viewer back.
 * Skipped ones come back once the end of the run is reached, since a rewatch
 * only ends when every episode has been seen again. `run` is the regular run
 * in airing order, aired episodes only.
 */
export function nextInRewatch<T>(
  run: readonly T[],
  rewatched: (episode: T) => boolean,
): T | null {
  const last = run.findLastIndex(rewatched);
  return run[last + 1] ?? run.find((episode) => !rewatched(episode)) ?? null;
}
