<script lang="ts">
  // The review modal, opened from a library table row: a rating lives in
  // the entry's review, so editing it goes through the same form as the
  // work's page. Waits for the viewer's review, if any, before opening.
  import { auth } from "$lib/auth.svelte";
  import type { LibraryItemView } from "$lib/library-view";
  import { createMyReview } from "$lib/my-review.svelte";
  import { useQueryClient } from "@tanstack/svelte-query";
  import ReviewFormModal from "./ReviewFormModal.svelte";

  let {
    item,
    onClose,
  }: {
    item: LibraryItemView;
    onClose: () => void;
  } = $props();

  const queryClient = useQueryClient();
  const mine = createMyReview(() => ({
    targetType: item.reviewTarget.type,
    targetId: item.reviewTarget.id,
  }));

  // The row's rating comes from the library list: refetch it.
  function refreshLibrary() {
    void queryClient.invalidateQueries({ queryKey: ["library"] });
  }
</script>

{#if mine.loaded}
  <ReviewFormModal
    title={item.title}
    meta={item.subtitle ?? undefined}
    imageUrl={item.imageUrl}
    targetType={item.reviewTarget.type}
    targetId={item.reviewTarget.id}
    review={mine.review}
    defaultVisibility={auth.user?.defaultReviewVisibility ?? "FRIENDS"}
    {onClose}
    onSaved={(review) => {
      mine.set(review);
      refreshLibrary();
    }}
    onDeleted={() => {
      mine.set(null);
      refreshLibrary();
    }} />
{/if}
