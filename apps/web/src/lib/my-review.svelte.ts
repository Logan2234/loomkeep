import { getMyReview } from "$lib/api/client";
import { keys } from "$lib/api/keys";
import { createApiQuery } from "$lib/api/query.svelte";
import type { ReviewDto, ReviewTargetType } from "@loomkeep/shared";
import { useQueryClient } from "@tanstack/svelte-query";

// The viewer's own review for a target, shared by every surface that shows
// or edits it (hero badge, reviews section) — one cache entry, so a save from
// either is reflected in both.
export function createMyReview(
  target: () => { targetType: ReviewTargetType; targetId: string },
) {
  const queryClient = useQueryClient();
  const key = () => keys.reviews.mine(target().targetType, target().targetId);

  const query = createApiQuery(() => ({
    key: key(),
    fetch: () => getMyReview(target().targetType, target().targetId),
  }));

  return {
    get review(): ReviewDto | null {
      return query.data ?? null;
    },
    get loaded(): boolean {
      return !query.loading;
    },
    /** Call from the review modal's onSaved (the review) / onDeleted (null). */
    set(value: ReviewDto | null) {
      queryClient.setQueryData(key(), value);
    },
  };
}
