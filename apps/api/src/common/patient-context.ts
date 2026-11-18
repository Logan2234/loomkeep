import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<true>();

/**
 * Runs `work` as background work: a provider that has rate-limited the
 * instance makes it wait the ban out rather than fail. Someone waiting on a
 * page wants a quick error instead, which is the default outside this scope.
 * A context rather than a parameter, so the import job doesn't thread it
 * through every catalogue service between it and the provider.
 */
export function runPatiently<T>(work: () => Promise<T>): Promise<T> {
  return storage.run(true, work);
}

/** Whether the caller is background work, see {@link runPatiently}. */
export function isPatient(): boolean {
  return storage.getStore() === true;
}
