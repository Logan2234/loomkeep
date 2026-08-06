<script lang="ts">
  import {
    batchDeleteReviews,
    batchSetReviewVisibility,
    getMyReviews,
  } from "$lib/api/client";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ReviewFormModal from "$lib/components/ReviewFormModal.svelte";
  import { appConfig } from "$lib/config.svelte";
  import type { MyReviewDto, ReviewVisibility } from "@loomkeep/shared";

  const TYPE_LABEL: Record<string, string> = {
    MEDIA: "Vidéo",
    GAME: "Jeux",
    BOOK: "Livres",
    MUSIC: "Musique",
    SEASON: "Saison",
    EPISODE: "Épisode",
  };

  let reviews = $state<MyReviewDto[]>([]);
  let loading = $state(true);

  // Bulk-selection state (review ids).
  let selected = $state<string[]>([]);
  let batchBusy = $state(false);
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

  async function batchDelete() {
    if (selected.length === 0 || batchBusy) return;
    batchBusy = true;
    try {
      await batchDeleteReviews(selected);
      const removed = new Set(selected);
      reviews = reviews.filter((r) => !removed.has(r.id));
      clearSelection();
    } finally {
      batchBusy = false;
    }
  }

  async function batchVisibility(visibility: ReviewVisibility) {
    if (selected.length === 0 || batchBusy) return;
    batchBusy = true;
    try {
      await batchSetReviewVisibility(selected, visibility);
      const changed = new Set(selected);
      reviews = reviews.map((r) =>
        changed.has(r.id) ? { ...r, visibility } : r,
      );
      clearSelection();
    } finally {
      batchBusy = false;
    }
  }

  // Edit modal state.
  let editing = $state<MyReviewDto | null>(null);

  $effect(() => {
    getMyReviews()
      .then((r) => (reviews = r))
      .finally(() => (loading = false));
  });

  function openEdit(review: MyReviewDto) {
    editing = review;
  }

  function closeEdit() {
    editing = null;
  }

  function handleSaved(updated: {
    rating: number;
    text: string | null;
    visibility: ReviewVisibility;
  }) {
    if (!editing) return;
    reviews = reviews.map((r) =>
      r.id === editing!.id ? { ...r, ...updated, target: r.target } : r,
    );
  }

  function handleDeleted() {
    if (!editing) return;
    reviews = reviews.filter((r) => r.id !== editing!.id);
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:py-8">
  <PageHeader
    icon="star"
    title="Mes reviews"
    subtitle="Toutes vos notes et critiques, à gérer d'un seul endroit." />

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
      <p class="font-display text-lg font-bold">Aucune review pour l'instant</p>
      <p class="mt-1 text-sm">
        Notez une œuvre depuis sa page pour la retrouver ici.
      </p>
    </EmptyState>
  {:else}
    <!-- Selection toolbar: batch delete, and (social only) batch audience. -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <label
        class="text-dim flex cursor-pointer items-center gap-2 text-sm select-none">
        <input
          type="checkbox"
          class="accent-accent h-4 w-4"
          checked={allSelected}
          onchange={toggleAll} />
        {selected.length > 0
          ? `${selected.length} sélectionnée${selected.length > 1 ? "s" : ""}`
          : "Tout sélectionner"}
      </label>

      {#if selected.length > 0}
        <div class="ml-auto flex flex-wrap items-center gap-2">
          {#if appConfig.socialEnabled}
            <span class="text-dim text-xs">Portée :</span>
            <button
              class="chip"
              disabled={batchBusy}
              onclick={() => batchVisibility("FRIENDS")}>
              Amis
            </button>
            <button
              class="chip"
              disabled={batchBusy}
              onclick={() => batchVisibility("PUBLIC")}>
              Public
            </button>
          {/if}
          {#if confirmingBatchDelete}
            <button
              class="btn btn-danger btn-sm"
              disabled={batchBusy}
              onclick={batchDelete}>
              Confirmer la suppression
            </button>
          {:else}
            <button
              class="btn btn-ghost btn-sm"
              disabled={batchBusy}
              onclick={() => (confirmingBatchDelete = true)}>
              Supprimer
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
            class="accent-accent h-4 w-4 shrink-0"
            aria-label="Sélectionner cette review"
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
                {review.target?.title ?? "Œuvre"}
              </p>
              <p class="text-dim flex flex-wrap items-center gap-x-2 text-xs">
                <span class="timecode uppercase"
                  >{TYPE_LABEL[review.targetType] ?? review.targetType}</span>
                {#if appConfig.socialEnabled}
                  <span aria-hidden="true">·</span>
                  <span
                    >{review.visibility === "PUBLIC" ? "Public" : "Amis"}</span>
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
            Éditer
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if editing}
  <ReviewFormModal
    title={editing.target?.title ?? "Modifier la review"}
    targetType={editing.targetType}
    targetId={editing.targetId}
    review={editing}
    onClose={closeEdit}
    onSaved={handleSaved}
    onDeleted={handleDeleted} />
{/if}
