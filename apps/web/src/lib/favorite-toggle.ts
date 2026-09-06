import { resolveApiError } from "./api/errors";
import { toast } from "./toast.svelte";

/**
 * Optimistically flips `entry.favorite`, rolling back and toasting the error
 * if the request fails. `entry` must come from a reactive ($state-backed)
 * list for the in-place mutation to update the UI.
 */
export async function toggleFavorite<T extends { favorite: boolean }>(
  entry: T,
  next: boolean,
  update: (next: boolean) => Promise<unknown>,
): Promise<void> {
  entry.favorite = next;

  try {
    await update(next);
  } catch (err) {
    entry.favorite = !next;
    toast.error(resolveApiError(err));
  }
}
