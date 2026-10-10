<script lang="ts">
  import {
    batchDeleteReviews,
    batchSetReviewVisibility,
    getMyReviews,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import DomainOffMark from "#lib/components/DomainOffMark.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import ReviewFormModal from "#lib/components/ReviewFormModal.svelte";
  import SegmentedControl from "#lib/components/SegmentedControl.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { isDomainEnabled, targetDomain } from "#lib/domains.js";
  import { DATE_MEDIUM_OPTIONS, formatDate } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type {
    MyReviewDto,
    ReviewTargetType,
    ReviewVisibility,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { flip } from "svelte/animate";
  import { fade, fly, slide } from "svelte/transition";

  type Group = "all" | "media" | "games" | "books" | "music";
  type Sort = "recent" | "best";

  const TYPE_LABEL: Record<ReviewTargetType, string> = {
    MEDIA: m.common_Media(),
    GAME: m.common_Games(),
    BOOK: m.common_Books(),
    MUSIC: m.common_Music(),
    SEASON: m.common_season(),
    EPISODE: m.common_episode(),
  };

  // Seasons and episodes sit with the films and series they belong to.
  const GROUP_OF: Record<ReviewTargetType, Exclude<Group, "all">> = {
    MEDIA: "media",
    SEASON: "media",
    EPISODE: "media",
    GAME: "games",
    BOOK: "books",
    MUSIC: "music",
  };

  const GROUP_LABEL: Record<Group, string> = {
    all: m.common_all(),
    media: m.common_Media(),
    games: m.common_Games(),
    books: m.common_Books(),
    music: m.common_Music(),
  };

  const reduced = prefersReducedMotion();

  const reviewsQuery = createApiQuery(() => ({
    key: keys.profile.myReviews(),
    fetch: getMyReviews,
  }));
  const reviews = $derived(reviewsQuery.data ?? []);
  const loading = $derived(reviewsQuery.loading);

  let search = $state("");
  let group = $state<Group>("all");
  let sort = $state<Sort>("recent");

  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const groupOptions = $derived(
    (["all", "media", "games", "books", "music"] as const)
      .filter(
        (value) =>
          value === "all" ||
          reviews.some((review) => GROUP_OF[review.targetType] === value),
      )
      .map((value) => ({ value, label: GROUP_LABEL[value] })),
  );

  const SORT_OPTIONS: { value: Sort; label: string }[] = [
    { value: "recent", label: m.reviews_sort_recent() },
    { value: "best", label: m.reviews_sort_best() },
  ];

  const shown = $derived(
    reviews
      .filter(
        (review) =>
          (group === "all" || GROUP_OF[review.targetType] === group) &&
          normalize(review.target?.title ?? "").includes(normalize(search)),
      )
      .sort((a, b) =>
        sort === "best" && b.rating !== a.rating
          ? b.rating - a.rating
          : b.createdAt.localeCompare(a.createdAt),
      ),
  );

  const stats = $derived.by(() => {
    if (reviews.length === 0) return null;
    const average =
      reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    return {
      count: reviews.length,
      average: average.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      public: reviews.filter((review) => review.visibility === "PUBLIC").length,
    };
  });

  const subtitle = $derived(
    stats
      ? [
          stats.count === 1
            ? m.reviews_count_one({ count: stats.count })
            : m.reviews_count_other({ count: stats.count }),
          m.reviews_page_average({ average: stats.average }),
          ...(appConfig.socialEnabled
            ? [m.reviews_page_public({ count: stats.public })]
            : []),
        ].join(" · ")
      : m.reviews_page_subtitle(),
  );

  // Bulk selection (review ids), entered through the "Select" button.
  let selecting = $state(false);
  let selected = $state<string[]>([]);
  let confirmingBatchDelete = $state(false);

  function toggleSelecting() {
    selecting = !selecting;
    selected = [];
    confirmingBatchDelete = false;
  }

  function toggleSelected(id: string) {
    selected = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
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

  function metaLine(review: MyReviewDto): string {
    return [
      TYPE_LABEL[review.targetType],
      formatDate(review.createdAt, DATE_MEDIUM_OPTIONS),
      ...(appConfig.socialEnabled
        ? [
            review.visibility === "PUBLIC"
              ? m.common_public()
              : m.common_friends(),
          ]
        : []),
    ].join(" · ");
  }

  let editing = $state<MyReviewDto | null>(null);

  // ReviewFormModal isn't itself migrated yet — it saves/deletes directly,
  // so this list's cache needs an explicit nudge to pick the change up.
  const queryClient = useQueryClient();
  function handleReviewChanged() {
    void queryClient.invalidateQueries({ queryKey: keys.profile.myReviews() });
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 pb-28 md:py-8">
  <PageHeader
    icon="star"
    back="/app/profile"
    title={m.profile_reviews_title()}
    {subtitle} />

  {#if loading}
    <div class="space-y-3">
      {#each Array(4) as _, i (i)}
        <div class="card flex items-center gap-4 p-4">
          <div class="skeleton h-24 w-16 rounded"></div>
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
      <p class="mt-1 text-sm">{m.reviews_empty_hint()}</p>
    </EmptyState>
  {:else}
    <div class="mb-4 flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-0 flex-1 basis-56">
          <Icon
            name="search"
            class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            class="input pl-9"
            placeholder={m.reviews_search()}
            aria-label={m.reviews_search()}
            bind:value={search} />
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm shrink-0"
          aria-pressed={selecting}
          onclick={toggleSelecting}>
          {selecting ? m.reviews_selection_done() : m.common_select()}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        {#if groupOptions.length > 2}
          <SegmentedControl
            label={m.reviews_filter_domain()}
            options={groupOptions}
            value={group}
            onChange={(next) => (group = next)} />
        {/if}
        <SegmentedControl
          class="ml-auto"
          label={m.reviews_sort_label()}
          options={SORT_OPTIONS}
          value={sort}
          onChange={(next) => (sort = next)} />
      </div>
    </div>

    {#if shown.length === 0}
      <p
        class="text-dim py-6 text-sm"
        in:fade={{ duration: reduced ? 0 : 160 }}>
        {m.reviews_no_match()}
      </p>
    {/if}

    <ul class="space-y-3">
      {#each shown as review (review.id)}
        {@const isSelected = selected.includes(review.id)}
        {@const domain = targetDomain(review.targetType)}
        {@const off = !isDomainEnabled(domain)}
        {@const href = off ? null : review.target?.href}
        <!-- Still listed (and editable) when its domain is off, but its page
             can't open: a warning stands in for the link. -->
        <li
          class="card flex items-start gap-4 p-4 transition-colors {isSelected
            ? 'border-accent bg-accent/5'
            : ''}"
          animate:flip={{ duration: reduced ? 0 : 240 }}>
          {#if selecting}
            <div
              class="flex self-center"
              transition:slide={{ axis: "x", duration: reduced ? 0 : 180 }}>
              <input
                type="checkbox"
                name="selectedReviews"
                value={review.id}
                class="accent-accent h-4 w-4 shrink-0"
                aria-label={m.reviews_select()}
                checked={isSelected}
                onchange={() => toggleSelected(review.id)} />
            </div>
          {/if}

          <svelte:element
            this={href ? "a" : "div"}
            href={href ?? undefined}
            class="flex min-w-0 flex-1 items-start gap-4 {href ? 'group' : ''}">
            {#if review.target?.imageUrl}
              <img
                src={review.target.imageUrl}
                alt=""
                loading="lazy"
                class="h-24 w-16 shrink-0 rounded object-cover {off
                  ? 'opacity-70'
                  : ''}" />
            {:else}
              <div
                class="bg-surface-2 text-dim flex h-24 w-16 shrink-0 items-center justify-center rounded font-mono text-xs {off
                  ? 'opacity-70'
                  : ''}">
                {TYPE_LABEL[review.targetType]?.[0] ?? "?"}
              </div>
            {/if}

            <div class="min-w-0 flex-1">
              <p class="timecode text-micro tracking-wide uppercase">
                {metaLine(review)}
              </p>
              <div class="mt-0.5 flex items-center gap-1">
                <p
                  class="font-display min-w-0 truncate text-lg leading-tight font-bold {href
                    ? 'group-hover:text-accent transition-colors'
                    : ''}">
                  {review.target?.title ?? m.common_work()}
                </p>
                {#if off}
                  <DomainOffMark {domain} class="-my-1.5 shrink-0" />
                {/if}
              </div>
              {#if review.spoilerTag}
                <span
                  class="text-warning bg-warning/12 mt-1 inline-flex rounded-full px-2 text-[0.6rem] font-bold tracking-wide uppercase">
                  {m.reviews_spoiler_tag()}
                </span>
              {/if}
              {#if review.text}
                <p class="mt-1.5 line-clamp-3 text-sm leading-relaxed">
                  « {review.text} »
                </p>
              {:else}
                <p class="text-dim mt-1.5 text-sm">{m.reviews_no_text()}</p>
              {/if}
            </div>
          </svelte:element>

          <div class="flex shrink-0 flex-col items-end gap-2">
            <span
              class="bg-accent/15 text-accent rounded-md px-2.5 py-1 font-mono text-lg font-bold tabular-nums">
              {review.rating}<span class="text-accent/60 text-xs">/10</span>
            </span>
            <button
              class="btn-text"
              aria-label={m.reviews_edit()}
              onclick={() => (editing = review)}>
              <Icon name="edit" class="h-3.5 w-3.5" />
              {m.common_edit()}
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if selected.length > 0}
  <div
    class="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-30 flex justify-center px-4 md:bottom-6"
    transition:fly={{ y: reduced ? 0 : 24, duration: reduced ? 0 : 220 }}>
    <div
      class="border-border bg-surface pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 shadow-2xl"
      role="region"
      aria-label={m.reviews_selection_count({ count: selected.length })}>
      <span class="font-semibold">
        {m.reviews_selection_count({ count: selected.length })}
      </span>
      <span class="flex-1"></span>
      {#if appConfig.socialEnabled}
        <span class="timecode text-xs">{m.reviews_scope()}</span>
        <button
          class="btn btn-ghost btn-sm"
          disabled={batchBusy}
          onclick={() => batchVisibilityMut.mutate("FRIENDS")}>
          <Icon name="users" class="h-3.5 w-3.5" />
          {m.common_friends()}
        </button>
        <button
          class="btn btn-ghost btn-sm"
          disabled={batchBusy}
          onclick={() => batchVisibilityMut.mutate("PUBLIC")}>
          <Icon name="globe" class="h-3.5 w-3.5" />
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
          class="btn btn-ghost btn-sm hover:border-danger hover:text-danger"
          disabled={batchBusy}
          onclick={() => (confirmingBatchDelete = true)}>
          <Icon name="trash" class="h-3.5 w-3.5" />
          {m.common_delete()}
        </button>
      {/if}
      <button class="btn-text" onclick={clearSelection}>
        {m.common_cancel()}
      </button>
    </div>
  </div>
{/if}

{#if editing}
  <ReviewFormModal
    title={editing.target?.title ?? m.reviews_edit()}
    meta={TYPE_LABEL[editing.targetType]}
    imageUrl={editing.target?.imageUrl ?? null}
    targetType={editing.targetType}
    targetId={editing.targetId}
    review={editing}
    onClose={() => (editing = null)}
    onSaved={handleReviewChanged}
    onDeleted={handleReviewChanged} />
{/if}
