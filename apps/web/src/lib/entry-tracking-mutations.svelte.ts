import type { QueryKey } from "@tanstack/svelte-query";
import { createApiMutation } from "./api/mutation.svelte";
import { m } from "./paraglide/messages.js";

interface EntryTrackingMutationsOptions<TDetail, TChanges> {
  /** The detail query's own key, refetched after every mutation below. */
  detailKey: () => QueryKey;
  /** The currently loaded detail, read fresh at mutate time. */
  detail: () => TDetail | null | undefined;
  /** The tracked entry's id, once one exists. */
  entryId: () => string | undefined;
  /** Creates the library entry for a not-yet-tracked item. */
  upsert: (detail: TDetail) => Promise<unknown>;
  /** Patches the tracked entry (status, notes, ownership, favorite…). */
  update: (entryId: string, changes: TChanges) => Promise<unknown>;
  /** Removes the tracked entry entirely. */
  remove: (entryId: string) => Promise<unknown>;
  /** Records a rewatch/reread/replay. Omit for domains with no replay concept (e.g. music). */
  addReplay?: (entryId: string) => Promise<unknown>;
  /** Deletes one previously recorded replay. */
  removeReplay?: (replayId: string) => Promise<unknown>;
  /** Closes the confirmation modal once the entry is gone. */
  onRemoveSuccess: () => void;
}

/**
 * The add/patch/remove(/replay) mutation set every media-detail page (books,
 * games, music, media) wires up identically against its own domain's entry
 * endpoints — only the endpoint functions and the upsert payload's shape
 * differ. Factored out so a shared bugfix (e.g. the invalidation list) only
 * needs to land once.
 */
export function createEntryTrackingMutations<TDetail, TChanges>(
  opts: EntryTrackingMutationsOptions<TDetail, TChanges>,
) {
  const addMut = createApiMutation(() => ({
    mutate: () => opts.upsert(opts.detail()!),
    invalidates: [opts.detailKey()],
    errorToast: true,
  }));

  const patchMut = createApiMutation(() => ({
    mutate: (changes: TChanges) => opts.update(opts.entryId()!, changes),
    invalidates: [opts.detailKey()],
    errorToast: true,
  }));

  const removeMut = createApiMutation(() => ({
    mutate: () => opts.remove(opts.entryId()!),
    onSuccess: () => opts.onRemoveSuccess(),
    successToast: m.tracking_removed_toast(),
    invalidates: [opts.detailKey()],
    errorToast: true,
  }));

  const addReplayMut = createApiMutation(() => ({
    mutate: () => opts.addReplay!(opts.entryId()!),
    invalidates: [opts.detailKey()],
    errorToast: true,
  }));

  const removeReplayMut = createApiMutation(() => ({
    mutate: (replayId: string) => opts.removeReplay!(replayId),
    invalidates: [opts.detailKey()],
    errorToast: true,
  }));

  return { addMut, patchMut, removeMut, addReplayMut, removeReplayMut };
}
