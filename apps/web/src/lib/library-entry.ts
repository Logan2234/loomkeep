import { resolveApiError } from "$lib/api/errors";
import { toast } from "$lib/toast.svelte";

/**
 * Shared plumbing for the three detail pages (media, games, books): the
 * add / patch / remove / replay handlers plus reload, all built around the same
 * "set saving, call the API, reload, surface errors" shape. Only the technical
 * wiring lives here — everything domain-specific (the API calls, the add-error
 * wording, and all markup) is injected or stays in the page.
 *
 * The reactive state stays declared in each `+page.svelte` (so the templates
 * keep referencing `detail`, `error`, … by their bare names); the actions read
 * and write it through the accessor object passed as `state`.
 */

/** Minimal shape the actions need from any detail DTO. */
interface DetailWithEntry {
  entry: { id: string } | null;
}

/** Reactive state owned by the page; accessed through get/set accessors. */
export interface LibraryEntryState<TDetail extends DetailWithEntry> {
  detail: TDetail | null;
  error: string | null;
  saving: boolean;
  confirmRemove: boolean;
  removing: boolean;
}

export interface LibraryEntryConfig<TDetail extends DetailWithEntry, TChanges> {
  /** Fetches the detail; used by reload() and after every mutation. */
  load: () => Promise<TDetail>;
  /** Creates the library entry (the page builds its own upsert payload). */
  add: (detail: TDetail) => Promise<unknown>;
  /** Applies a partial update to the existing entry. */
  update: (entryId: string, changes: TChanges) => Promise<unknown>;
  /** Deletes the entry. */
  remove: (entryId: string) => Promise<unknown>;
  /** Records a replay/reread (games & books only). */
  addReplay?: (entryId: string) => Promise<unknown>;
  /** Deletes a replay/reread (games & books only). */
  removeReplay?: (replayId: string) => Promise<unknown>;
}

export interface LibraryEntryActions<TChanges> {
  reload: () => Promise<void>;
  add: () => Promise<void>;
  patch: (changes: TChanges) => Promise<void>;
  doRemove: () => Promise<void>;
  addReplay: () => Promise<void>;
  removeReplay: (replayId: string) => Promise<void>;
}

export function createLibraryEntryActions<
  TDetail extends DetailWithEntry,
  TChanges,
>(
  state: LibraryEntryState<TDetail>,
  config: LibraryEntryConfig<TDetail, TChanges>,
): LibraryEntryActions<TChanges> {
  async function reload(): Promise<void> {
    state.detail = await config.load();
  }

  async function add(): Promise<void> {
    const detail = state.detail;
    if (!detail) return;
    state.saving = true;
    state.error = null;

    try {
      await config.add(detail);
      await reload();
    } catch (err) {
      state.error = resolveApiError(err);
    } finally {
      state.saving = false;
    }
  }

  async function patch(changes: TChanges): Promise<void> {
    const entry = state.detail?.entry;
    if (!entry) return;
    state.saving = true;
    state.error = null;

    try {
      await config.update(entry.id, changes);
      await reload(); // Re-fetch so the derived status/progress refresh.
    } catch (err) {
      state.error = resolveApiError(err);
    } finally {
      state.saving = false;
    }
  }

  async function doRemove(): Promise<void> {
    const entry = state.detail?.entry;
    if (!entry) return;
    state.removing = true;
    state.error = null;

    try {
      await config.remove(entry.id);
      state.confirmRemove = false;
      toast.success("Retiré de ta bibliothèque.");
      await reload(); // Entry becomes null → the page returns to the "add" state.
    } catch (err) {
      state.error = resolveApiError(err);
    } finally {
      state.removing = false;
    }
  }

  async function addReplay(): Promise<void> {
    const entry = state.detail?.entry;
    if (!entry || !config.addReplay) return;
    state.saving = true;
    state.error = null;

    try {
      await config.addReplay(entry.id);
      await reload();
    } catch (err) {
      state.error = resolveApiError(err);
    } finally {
      state.saving = false;
    }
  }

  async function removeReplay(replayId: string): Promise<void> {
    if (!config.removeReplay) return;
    state.saving = true;
    state.error = null;

    try {
      await config.removeReplay(replayId);
      await reload();
    } catch (err) {
      state.error = resolveApiError(err);
    } finally {
      state.saving = false;
    }
  }

  return { reload, add, patch, doRemove, addReplay, removeReplay };
}
