<script lang="ts">
  import {
    batchDeleteReviews,
    batchSetReviewVisibility,
    getMyReviews,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ReviewFormModal from "$lib/components/ReviewFormModal.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { MyReviewDto, ReviewVisibility } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";

  const TYPE_LABEL: Record<string, string> = {
    MEDIA: m.common_Media(),
    GAME: m.common_Games(),
    BOOK: m.common_Books(),
    MUSIC: m.common_Music(),
    SEASON: m.common_season(),
    EPISODE: m.common_episode(),
  };

  const reviewsQuery = createApiQuery(() => ({
    key: keys.profile.myReviews(),
    fetch: getMyReviews,
  }));
  const reviews = $derived(reviewsQuery.data ?? []);
  const loading = $derived(reviewsQuery.loading);

  // Bulk-selection state (review ids).
  let selected = $state<string[]>([]);
  let confirmingBatchDelete = $state(false);
  const allSelected = $derived(
    reviews.length > 0 && selected.length === reviews.length,
  );

  function toggleSelected(id: string) {
    selected = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    confirmingBatchDelete = false;
  }

  function toggleAll() {
    selected = allSelected ? [] : reviews.map((r) => r.id);
    confirmingBatchDelete = false;
  }

  function clearSelection() {
    selected = [];
    confirmingBatchDelete = false;
  }

  const batchDeleteMut = createApiMutation(() => ({
    mutate: () => batchDeleteReviews(selected),
    invalidates: [keys.profile.myReviews()],
    onSuccess: clearSelection,
  }));

  const batchVisibilityMut = createApiMutation(() => ({
    mutate: (visibility: ReviewVisibility) =>
      batchSetReviewVisibility(selected, visibility),
    invalidates: [keys.profile.myReviews()],
    onSuccess: clearSelection,
  }));

  const batchBusy = $derived(
    batchDeleteMut.loading || batchVisibilityMut.loading,
  );

  // Edit modal state.
  let editing = $state<MyReviewDto | null>(null);

  function openEdit(review: MyReviewDto) {
    editing = review;
  }

  function closeEdit() {
    editing = null;
  }

  // ReviewFormModal isn't itself migrated yet — it saves/deletes directly,
  // so this list's cache needs an explicit nudge to pick the change up.
  const queryClient = useQueryClient();
  function handleReviewChanged() {
    void queryClient.invalidateQueries({ queryKey: keys.profile.myReviews() });
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:py-8">
  <PageHeader
    icon="star"
    title={m.profile_reviews_title()}
    subtitle={m.reviews_page_subtitle()} />

  {#if loading}
    <div class="space-y-2">
      {#each Array(4) as _, i (i)}
        <div class="card flex items-center gap-3 p-3">
          <div class="skeleton h-16 w-12 rounded"></div>
          <div class="flex-1 space-y-2">
            <div class="skeleton h-4 w-48 rounded"></div>
            <div class="skeleton h-3 w-24 rounded"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if reviews.length === 0}
    <EmptyState>
      <p class="font-display text-lg font-bold">{m.reviews_empty()}</p>
      <p class="mt-1 text-sm">
        {m.reviews_empty_hint()}
      </p>
    </EmptyState>
  {:else}
    <!-- Selection toolbar: batch delete, and (social only) batch audience. -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <label
        class="text-dim flex cursor-pointer items-center gap-2 text-sm select-none">
        <input
          type="checkbox"
          name="selectAll"
          class="accent-accent h-4 w-4"
          checked={allSelected}
          onchange={toggleAll} />
        {selected.length > 0
          ? m.reviews_selection_count({ count: selected.length })
          : m.common_select_all()}
      </label>

      {#if selected.length > 0}
        <div class="ml-auto flex flex-wrap items-center gap-2">
          {#if appConfig.socialEnabled}
            <span class="text-dim text-xs">{m.reviews_scope()}</span>
            <button
              class="chip"
              disabled={batchBusy}
              onclick={() => batchVisibilityMut.mutate("FRIENDS")}>
              {m.common_friends()}
            </button>
            <button
              class="chip"
              disabled={batchBusy}
              onclick={() => batchVisibilityMut.mutate("PUBLIC")}>
              {m.common_public()}
            </button>
          {/if}
          {#if confirmingBatchDelete}
            <button
              class="btn btn-danger btn-sm"
              disabled={batchBusy}
              onclick={() => batchDeleteMut.mutate()}>
              {m.reviews_confirm_delete()}
            </button>
          {:else}
            <button
              class="btn btn-ghost btn-sm"
              disabled={batchBusy}
              onclick={() => (confirmingBatchDelete = true)}>
              {m.common_delete()}
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <ul class="space-y-2">
      {#each reviews as review (review.id)}
        <li class="card flex items-center gap-3 p-3">
          <input
            type="checkbox"
            name="selectedReviews"
            value={review.id}
            class="accent-accent h-4 w-4 shrink-0"
            aria-label={m.reviews_select()}
            checked={selected.includes(review.id)}
            onchange={() => toggleSelected(review.id)} />

          <!-- The work: a link to its detail page when browsable. -->
          <svelte:element
            this={review.target?.href ? "a" : "div"}
            href={review.target?.href ?? undefined}
            class="flex min-w-0 flex-1 items-center gap-3 {review.target?.href
              ? 'group'
              : ''}">
            {#if review.target?.imageUrl}
              <img
                src={review.target.imageUrl}
                alt=""
                class="h-16 w-12 shrink-0 rounded object-cover" />
            {:else}
              <div
                class="bg-surface-2 text-dim flex h-16 w-12 shrink-0 items-center justify-center rounded font-mono text-xs">
                {TYPE_LABEL[review.targetType]?.[0] ?? "?"}
              </div>
            {/if}

            <div class="min-w-0 flex-1">
              <p
                class="truncate font-semibold {review.target?.href
                  ? 'group-hover:text-accent transition-colors'
                  : ''}">
                {review.target?.title ?? m.common_work()}
              </p>
              <p class="text-dim flex flex-wrap items-center gap-x-2 text-xs">
                <span class="timecode uppercase"
                  >{TYPE_LABEL[review.targetType] ?? review.targetType}</span>
                {#if appConfig.socialEnabled}
                  <span aria-hidden="true">·</span>
                  <span
                    >{review.visibility === "PUBLIC"
                      ? m.common_public()
                      : m.common_friends()}</span>
                {/if}
              </p>
              {#if review.text}
                <p class="text-dim mt-1 line-clamp-1 text-sm italic">
                  « {review.text} »
                </p>
              {/if}
            </div>
          </svelte:element>

          <!-- Rating in the Séance amber marquee cartouche. -->
          <span
            class="bg-accent/15 text-accent shrink-0 rounded-md px-2.5 py-1 font-mono font-bold tabular-nums">
            {review.rating}<span class="text-accent/60 text-xs">/10</span>
          </span>
          <button
            class="btn btn-ghost shrink-0"
            onclick={() => openEdit(review)}>
            {m.common_edit()}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if editing}
  <ReviewFormModal
    title={editing.target?.title ?? m.reviews_edit()}
    targetType={editing.targetType}
    targetId={editing.targetId}
    review={editing}
    onClose={closeEdit}
    onSaved={handleReviewChanged}
    onDeleted={handleReviewChanged} />
{/if}
