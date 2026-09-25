<script lang="ts">
  import {
    deleteReview,
    getReviewRevisions,
    upsertReview,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { DATE_MEDIUM_OPTIONS, formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import {
    clearReviewDraft,
    readReviewDraft,
    writeReviewDraft,
  } from "$lib/review-draft";
  import {
    REVIEW_TEXT_MAX_LENGTH,
    type ReviewDto,
    type ReviewTargetType,
    type ReviewVisibility,
  } from "@loomkeep/shared";
  import { onDestroy, untrack } from "svelte";
  import Modal from "./Modal.svelte";
  import Poster from "./Poster.svelte";
  import RatingSlider from "./RatingSlider.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import Switch from "./Switch.svelte";

  // Shared "add/edit a review" modal — used by /reviews (bulk management),
  // the per-work review section and the hero rating badge on detail pages,
  // so all stay in lockstep.
  let {
    title,
    meta,
    imageUrl,
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
    /** Timecode line above the title ("FILM · 2024", "S01E04"…). */
    meta?: string;
    /** Poster/cover thumbnail; omitted = no thumbnail. */
    imageUrl?: string | null;
    targetType: ReviewTargetType;
    targetId: string;
    /** The existing review to edit, or null/undefined to create one. */
    review?: {
      rating: number;
      text: string | null;
      visibility: ReviewVisibility;
      spoilerTag?: boolean;
    } | null;
    /** Seeds the audience for a brand-new review. */
    defaultVisibility?: ReviewVisibility;
    onClose: () => void;
    onSaved: (review: ReviewDto) => void;
    onDeleted?: () => void;
  } = $props();

  const NEAR_LIMIT = REVIEW_TEXT_MAX_LENGTH - 200;
  const DRAFT_TEXT_DELAY_MS = 400;

  // The modal is mounted per opening, so the form is seeded once from the
  // props: a background refetch of the review mid-edit must not overwrite
  // what the user is typing or choosing.
  const initial = untrack(() => {
    const saved = {
      rating: review?.rating ?? null,
      text: review?.text ?? "",
      spoilerTag: review?.spoilerTag ?? false,
    };
    const stored = auth.user
      ? readReviewDraft(auth.user.id, targetType, targetId)
      : null;
    const restored =
      stored !== null &&
      (stored.rating !== saved.rating ||
        stored.text !== saved.text ||
        stored.spoilerTag !== saved.spoilerTag);
    return {
      ...(restored && stored ? stored : saved),
      visibility: review?.visibility ?? defaultVisibility,
      restored,
      targetType,
      targetId,
    };
  });

  let formRating = $state<number | null>(initial.rating);
  let formText = $state(initial.text);
  let formSpoiler = $state(initial.spoilerTag);
  let formVisibility = $state<ReviewVisibility>(initial.visibility);
  let confirmingDelete = $state(false);
  let showRevisions = $state(false);

  let pendingTextSave: ReturnType<typeof setTimeout> | null = null;

  function persistDraft() {
    cancelPendingTextSave();
    if (!auth.user) return;
    writeReviewDraft(auth.user.id, initial.targetType, initial.targetId, {
      rating: formRating,
      text: formText,
      spoilerTag: formSpoiler,
    });
  }

  function cancelPendingTextSave() {
    if (pendingTextSave === null) return;
    clearTimeout(pendingTextSave);
    pendingTextSave = null;
  }

  // Typing writes on a short pause rather than on every keystroke; an
  // accidental close in between still keeps the latest text.
  function setText(value: string) {
    formText = value;
    cancelPendingTextSave();
    pendingTextSave = setTimeout(persistDraft, DRAFT_TEXT_DELAY_MS);
  }

  function discardDraft() {
    cancelPendingTextSave();
    if (auth.user) {
      clearReviewDraft(auth.user.id, initial.targetType, initial.targetId);
    }
  }

  onDestroy(() => {
    if (pendingTextSave !== null) persistDraft();
  });

  function setRating(value: number | null) {
    formRating = value;
    persistDraft();
  }

  function setSpoiler(value: boolean) {
    formSpoiler = value;
    persistDraft();
  }

  // An explicit Cancel discards the draft; the close cross, backdrop and
  // swipe keep it — those are the accidental closes drafts exist for.
  function cancel() {
    discardDraft();
    onClose();
  }

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
        spoilerTag: formSpoiler,
      }),
    coveredFields: ["rating", "text"],
    onSuccess: (updated) => {
      discardDraft();
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
      discardDraft();
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

<Modal {title} eyebrow={meta} onclose={onClose}>
  {#snippet leading()}
    {#if imageUrl !== undefined}
      <div
        class="w-10 shrink-0 overflow-hidden rounded-md ring-1 ring-white/10">
        <Poster src={imageUrl} {title} />
      </div>
    {/if}
  {/snippet}

  <div class="flex flex-col gap-[18px]">
    <RatingSlider value={formRating} onChange={setRating} />

    <div>
      <label
        for="review-text"
        class="timecode mb-1.5 block text-[0.62rem] tracking-[0.18em] uppercase">
        {m.reviews_optional_text()}
      </label>
      <textarea
        id="review-text"
        name="text"
        class="input min-h-[110px] resize-y leading-normal"
        rows="4"
        placeholder={m.reviews_text_placeholder()}
        maxlength={REVIEW_TEXT_MAX_LENGTH}
        value={formText}
        oninput={(e) => setText(e.currentTarget.value)}></textarea>
      <div class="mt-2 flex items-center justify-between gap-3">
        {#if appConfig.socialEnabled}
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={formSpoiler} onChange={setSpoiler} />
            {m.reviews_spoiler_toggle()}
          </label>
        {/if}
        <p class="timecode ml-auto text-right text-[0.7rem]">
          {#if initial.restored}
            <span class="text-accent">{m.reviews_draft_restored()}</span> ·
          {/if}
          <span class:text-accent={formText.length > NEAR_LIMIT}
            >{formText.length} / {REVIEW_TEXT_MAX_LENGTH}</span>
        </p>
      </div>
    </div>

    {#if appConfig.socialEnabled}
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
          {m.common_visible_to()}
        </span>
        <SegmentedControl
          label={m.common_visible_to()}
          options={[
            { value: "FRIENDS", label: m.common_friends(), icon: "users" },
            { value: "PUBLIC", label: m.common_public(), icon: "globe" },
          ]}
          value={formVisibility}
          onChange={(v) => (formVisibility = v)} />
      </div>
    {/if}

    {#if showRevisions}
      <ul class="border-border space-y-2 border-l pl-3">
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
    {/if}

    {#if error}
      <p class="text-danger text-sm">{error}</p>
    {/if}
  </div>

  {#snippet actions()}
    <div class="flex items-center gap-2">
      {#if review}
        {#if confirmingDelete}
          <button
            class="btn btn-danger btn-sm"
            disabled={busy}
            onclick={doDelete}>
            {m.common_confirm()}
          </button>
        {:else}
          <button
            class="btn-text hover:text-danger px-1.5 py-1 text-[0.8rem]"
            disabled={busy}
            onclick={() => (confirmingDelete = true)}>
            {m.common_delete()}
          </button>
        {/if}
        {#if revisions.length > 1}
          <button
            class="btn-text px-1.5 py-1 text-[0.8rem]"
            aria-expanded={showRevisions}
            onclick={() => (showRevisions = !showRevisions)}>
            {m.reviews_revisions_link({ count: revisions.length })}
          </button>
        {/if}
      {/if}
      <span class="flex-1"></span>
      <button class="btn btn-ghost" disabled={busy} onclick={cancel}>
        {m.common_cancel()}
      </button>
      <button
        class="btn btn-primary"
        disabled={busy || formRating === null}
        onclick={save}>
        {m.common_save()}
      </button>
    </div>
  {/snippet}
</Modal>
