<script lang="ts">
  import {
    deleteReview,
    getReviewRevisions,
    upsertReview,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { DATE_MEDIUM_OPTIONS, formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import {
    REVIEW_TEXT_MAX_LENGTH,
    type ReviewDto,
    type ReviewTargetType,
    type ReviewVisibility,
  } from "@loomkeep/shared";
  import Modal from "./Modal.svelte";
  import RatingPips from "./RatingPips.svelte";

  // Shared "add/edit a review" modal — used by /reviews (bulk management) and
  // the per-work review section on detail pages, so both stay in lockstep.
  let {
    title,
    targetType,
    targetId,
    review = null,
    defaultVisibility = "FRIENDS",
    onClose,
    onSaved,
    onDeleted,
  }: {
    /** Modal heading — the work's title. */
    title: string;
    targetType: ReviewTargetType;
    targetId: string;
    /** The existing review to edit, or null/undefined to create one. */
    review?: {
      rating: number;
      text: string | null;
      visibility: ReviewVisibility;
    } | null;
    /** Seeds the audience for a brand-new review. */
    defaultVisibility?: ReviewVisibility;
    onClose: () => void;
    onSaved: (review: ReviewDto) => void;
    onDeleted?: () => void;
  } = $props();

  let formRating = $derived<number | null>(review?.rating ?? null);
  let formText = $derived(review?.text ?? "");
  let formVisibility = $derived<ReviewVisibility>(
    review?.visibility ?? defaultVisibility,
  );
  let confirmingDelete = $state(false);

  const revisionsQuery = createApiQuery(() => ({
    key: keys.reviews.revisions(targetType, targetId),
    fetch: () => getReviewRevisions(targetType, targetId),
    enabled: !!review,
  }));
  const revisions = $derived(revisionsQuery.data ?? []);

  const saveMut = createApiMutation(() => ({
    mutate: () =>
      upsertReview(targetType, targetId, {
        rating: formRating!,
        text: formText.trim() || null,
        visibility: formVisibility,
      }),
    coveredFields: ["rating", "text"],
    onSuccess: (updated) => {
      onSaved(updated);
      onClose();
    },
  }));

  function save() {
    if (formRating === null || saveMut.loading) return;
    saveMut.mutate();
  }

  const deleteMut = createApiMutation(() => ({
    mutate: () => deleteReview(targetType, targetId),
    onSuccess: () => {
      onDeleted?.();
      onClose();
    },
  }));

  function doDelete() {
    if (deleteMut.loading) return;
    deleteMut.mutate();
  }

  const busy = $derived(saveMut.loading || deleteMut.loading);
  const error = $derived(saveMut.error ?? deleteMut.error);
</script>

<Modal {title} onclose={onClose}>
  <div class="space-y-4">
    <RatingPips value={formRating} onChange={(v) => (formRating = v)} />

    <div>
      <label
        for="review-text"
        class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
        {m.reviews_optional_text()}
      </label>
      <textarea
        id="review-text"
        class="input min-h-24 resize-y"
        placeholder={m.reviews_text_placeholder()}
        maxlength={REVIEW_TEXT_MAX_LENGTH}
        bind:value={formText}></textarea>
      <p class="text-dim mt-1 text-right text-xs">
        {formText.length}/{REVIEW_TEXT_MAX_LENGTH}
      </p>
    </div>

    {#if appConfig.socialEnabled}
      <div>
        <span
          class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
          {m.common_visible_to()}
        </span>
        <div class="flex gap-2">
          <button
            class="chip"
            class:chip-on={formVisibility === "FRIENDS"}
            onclick={() => (formVisibility = "FRIENDS")}>
            {m.common_friends()}
          </button>
          <button
            class="chip"
            class:chip-on={formVisibility === "PUBLIC"}
            onclick={() => (formVisibility = "PUBLIC")}>
            {m.common_public()}
          </button>
        </div>
      </div>
    {/if}

    {#if revisions.length > 1}
      <details class="text-sm">
        <summary class="text-dim cursor-pointer select-none">
          {m.reviews_revision_count({ count: revisions.length })}
        </summary>
        <ul class="border-border mt-2 space-y-2 border-l pl-3">
          {#each revisions as rev, i (i)}
            <li class="text-dim text-xs">
              <div class="flex items-center gap-2">
                <span class="timecode text-fg"
                  >V{revisions.length - i} · {rev.rating}/10</span>
                <span>{formatDate(rev.createdAt, DATE_MEDIUM_OPTIONS)}</span>
              </div>
              {#if rev.text}
                <p class="mt-0.5 text-sm italic">« {rev.text} »</p>
              {:else}
                <p class="mt-0.5 italic opacity-60">{m.reviews_no_text()}</p>
              {/if}
            </li>
          {/each}
        </ul>
      </details>
    {/if}

    {#if error}
      <p class="text-danger text-sm">{error}</p>
    {/if}

    <div class="flex items-center gap-2 pt-1">
      <button
        class="btn btn-primary flex-1"
        disabled={busy || formRating === null}
        onclick={save}>
        {m.common_save()}
      </button>
      {#if review}
        {#if confirmingDelete}
          <button class="btn btn-danger" disabled={busy} onclick={doDelete}>
            {m.common_confirm()}
          </button>
        {:else}
          <button
            class="btn btn-ghost"
            disabled={busy}
            onclick={() => (confirmingDelete = true)}>
            {m.common_delete()}
          </button>
        {/if}
      {/if}
    </div>
  </div>
</Modal>
