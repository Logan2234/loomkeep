<script lang="ts">
  import {
    deleteAdminCacheItem,
    deleteAdminCacheOrphans,
    getAdminCache,
    getAdminCacheItem,
    resyncAdminCacheItem,
    resyncAdminCacheStale,
  } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { formatDateTime } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import type { IconName } from "$lib/types/icon-name";
  import type {
    AdminCacheItemDto,
    AdminCacheListResponseDto,
    AdminCacheSort,
    Domain,
  } from "@loomkeep/shared";

  const SORT_OPTIONS: { label: string; value: AdminCacheSort }[] = [
    { label: "Obsolètes d'abord", value: "stale" },
    { label: "Récents", value: "recent" },
    { label: "Titre", value: "title" },
  ];

  const domainIcon = (d: Domain): IconName => DOMAINS[d]?.icon ?? "tv";

  let activeDomain = $state<Domain>("MEDIA");
  let sort = $state<AdminCacheSort>("stale");
  let orphansOnly = $state(false);
  let searchInput = $state("");
  let search = $state("");

  let showDeleteOrphansConfirm = $state(false);

  // --- detail drawer ---
  let selected = $state<AdminCacheItemDto | null>(null);
  let showDeleteConfirm = $state(false);

  const cacheKey = $derived(
    keys.admin.cacheItems({
      domain: activeDomain,
      search,
      sort,
      orphansOnly,
    }),
  );

  const cacheQuery = createApiInfiniteQuery<
    AdminCacheListResponseDto,
    number,
    AdminCacheItemDto
  >(() => ({
    key: cacheKey,
    fetch: (page) =>
      getAdminCache({
        domain: activeDomain,
        search: search || undefined,
        sort,
        orphans: orphansOnly || undefined,
        page,
      }),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? allPages.length + 1 : undefined;
    },
  }));

  const items = $derived(cacheQuery.data);
  const error = $derived(cacheQuery.error);
  const latestPage = $derived(cacheQuery.pages.at(-1));
  const total = $derived(latestPage?.total ?? 0);
  const staleTotal = $derived(latestPage?.staleTotal ?? 0);
  const orphanTotal = $derived(latestPage?.orphanTotal ?? 0);

  function selectDomain(domain: Domain) {
    activeDomain = domain;
  }

  function selectSort(next: AdminCacheSort) {
    sort = next;
  }

  function toggleOrphans() {
    orphansOnly = !orphansOnly;
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  function onSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      search = searchInput.trim();
    }, 300);
  }

  const detailQuery = createApiQuery(() => ({
    key: keys.admin.cacheItem(selected?.domain ?? "", selected?.id ?? ""),
    fetch: () => getAdminCacheItem(selected!.domain, selected!.id),
    enabled: !!selected,
  }));
  const detail = $derived(detailQuery.data);

  function closeDrawer() {
    selected = null;
    showDeleteConfirm = false;
  }

  // Shared by the per-item list button and the drawer's own button — both
  // hit the same endpoint. Also invalidates the drawer's detail key when one
  // is open, replacing the extra manual re-fetch that used to follow it.
  const resyncMut = createApiMutation(() => ({
    mutate: (item: AdminCacheItemDto) =>
      resyncAdminCacheItem(item.domain, item.id),
    onSuccess: (_data, item) =>
      toast.success(`« ${item.title} » re-synchronisé.`),
    invalidates: [
      cacheKey,
      ...(selected ? [keys.admin.cacheItem(selected.domain, selected.id)] : []),
    ],
    errorToast: true,
  }));

  const bulkResyncMut = createApiMutation(() => ({
    mutate: () => resyncAdminCacheStale(activeDomain),
    onSuccess: (res) =>
      toast.success(
        res.failed > 0
          ? `${res.resynced} re-synchronisé(s), ${res.failed} en échec.`
          : `${res.resynced} titre(s) re-synchronisé(s).`,
      ),
    invalidates: [cacheKey],
    errorToast: true,
  }));

  const deleteOrphansMut = createApiMutation(() => ({
    mutate: () => deleteAdminCacheOrphans(activeDomain),
    onSuccess: (res) => {
      showDeleteOrphansConfirm = false;
      toast.success(
        res.skipped > 0
          ? `${res.deleted} orphelin(s) supprimé(s) du cache — ${res.skipped} laissé(s) car référencé(s) par une critique, un commentaire ou une activité.`
          : `${res.deleted} orphelin(s) supprimé(s) du cache.`,
      );
    },
    onError: () => {
      showDeleteOrphansConfirm = false;
    },
    invalidates: [cacheKey],
    errorToast: true,
  }));

  const deleteItemMut = createApiMutation(() => ({
    mutate: (_title: string) =>
      deleteAdminCacheItem(detail!.domain, detail!.id),
    onSuccess: (_data, title) => {
      showDeleteConfirm = false;
      closeDrawer();
      toast.success(`« ${title} » supprimé du cache.`);
    },
    onError: () => {
      showDeleteConfirm = false;
    },
    invalidates: [cacheKey],
    errorToast: true,
  }));
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && selected && !showDeleteConfirm) closeDrawer();
  }} />

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="database"
    title="Cache & synchronisation"
    subtitle="Le cache à la demande : chaque titre n'existe ici qu'une fois référencé par un compte. Inspecte, re-synchronise ou purge les entrées orphelines." />

  <div class="mb-3 flex flex-wrap items-center gap-2">
    {#each Object.entries(DOMAINS) as [id, d] (id)}
      {#if d.comingSoon}
        <!-- Planned domain: nothing in cache yet, tab is non-clickable. -->
        <button
          class="chip disabled:pointer-events-none disabled:opacity-40"
          disabled
          title="Disponible prochainement">
          <Icon name={d.icon} class="mr-1 -ml-0.5 inline h-3.5 w-3.5" />
          {d.label}
          <span
            class="bg-surface-2 text-dim ml-1.5 rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold">
            {m.landing_libraries_soon()}
          </span>
        </button>
      {:else}
        <button
          class="chip"
          class:chip-on={activeDomain === id}
          onclick={() => selectDomain(id as Domain)}>
          <Icon name={d.icon} class="mr-1 -ml-0.5 inline h-3.5 w-3.5" />
          {d.label}
        </button>
      {/if}
    {/each}
  </div>

  <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
    <input
      type="text"
      bind:value={searchInput}
      oninput={onSearchInput}
      placeholder="Filtrer par titre…"
      class="input sm:flex-1" />
    <div class="flex items-center gap-2">
      <span
        class="text-dim hidden text-[0.65rem] font-bold tracking-wider uppercase sm:inline">
        Tri
      </span>
      <Combobox
        label="Tri"
        options={SORT_OPTIONS}
        values={[sort]}
        onChange={(v) => selectSort((v[0] as AdminCacheSort) ?? "stale")} />
    </div>
  </div>

  <!-- Bulk actions, scoped to the active domain. -->
  <div class="mb-5 flex flex-wrap items-center gap-2">
    <button class="chip" class:chip-on={orphansOnly} onclick={toggleOrphans}>
      Orphelins uniquement
    </button>
    <div class="ml-auto flex flex-wrap gap-2">
      <button
        onclick={() => bulkResyncMut.mutate()}
        disabled={bulkResyncMut.loading || staleTotal === 0}
        class="btn btn-ghost btn-sm">
        <Icon
          name="refresh"
          class="h-3.5 w-3.5 {bulkResyncMut.loading ? 'animate-spin' : ''}" />
        Re-sync obsolètes ({staleTotal})
      </button>
      <button
        onclick={() => (showDeleteOrphansConfirm = true)}
        disabled={deleteOrphansMut.loading || orphanTotal === 0}
        class="btn btn-danger btn-sm">
        <Icon name="trash" class="h-3.5 w-3.5" />
        Supprimer orphelins ({orphanTotal})
      </button>
    </div>
  </div>

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if cacheQuery.loading}
    <div class="space-y-2">
      {#each { length: 6 } as _, i (i)}
        <div class="card h-16 animate-pulse"></div>
      {/each}
    </div>
  {:else if items.length === 0}
    <EmptyState>
      {orphansOnly
        ? "Aucun orphelin dans ce domaine."
        : "Aucun titre en cache pour ce domaine."}
    </EmptyState>
  {:else}
    <p class="text-dim mb-2 text-xs">
      {total} titre(s){orphansOnly ? " orphelin(s)" : ""} · {staleTotal} obsolète(s)
      · {orphanTotal} orphelin(s).
    </p>
    <ul class="space-y-2">
      {#each items as item (item.id)}
        <li
          class="card hover:bg-surface-2 flex items-center gap-3 p-3 transition-colors {selected?.id ===
          item.id
            ? 'ring-accent ring-1'
            : ''}">
          <button
            type="button"
            onclick={() => (selected = item)}
            class="flex min-w-0 flex-1 items-center gap-3 text-left">
            {#if item.coverUrl}
              <img
                src={item.coverUrl}
                alt=""
                class="h-14 w-10 shrink-0 rounded object-cover" />
            {:else}
              <div
                class="bg-surface-2 text-dim flex h-14 w-10 shrink-0 items-center justify-center rounded">
                <Icon name={domainIcon(item.domain)} class="h-4 w-4" />
              </div>
            {/if}
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-fg truncate font-semibold">{item.title}</span>
                <span
                  class="border-border text-dim rounded-full border px-2 py-0.5 text-[10px] font-bold">
                  {item.canonicalSource}
                </span>
                {#if item.stale}
                  <span
                    class="border-accent/40 bg-accent/10 text-accent flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold">
                    <span class="bg-accent h-1.5 w-1.5 rounded-full"></span>
                    Obsolète
                  </span>
                {/if}
                {#if item.referenceCount === 0}
                  <span
                    class="border-border text-dim rounded-full border px-2 py-0.5 text-[10px] font-bold">
                    Orphelin
                  </span>
                {/if}
                {#if item.cachedLocales.length > 1}
                  <span
                    title={item.cachedLocales.join(", ")}
                    class="border-border text-dim rounded-full border px-2 py-0.5 text-[10px] font-bold">
                    {item.cachedLocales.length} langues
                  </span>
                {/if}
              </div>
              <p class="timecode mt-0.5 text-xs">
                Sync {formatDateTime(item.lastSyncedAt)}
                · {item.referenceCount} compte(s)
              </p>
            </div>
          </button>
          <button
            type="button"
            onclick={(e) => {
              e.stopPropagation();
              resyncMut.mutate(item);
            }}
            disabled={resyncMut.loading}
            aria-label="Re-synchroniser {item.title}"
            class="btn btn-ghost btn-sm shrink-0">
            <Icon
              name="refresh"
              class="h-3.5 w-3.5 {resyncMut.loading &&
              resyncMut.variables?.id === item.id
                ? 'animate-spin'
                : ''}" />
            <span class="hidden sm:inline">Re-sync</span>
          </button>
        </li>
      {/each}
    </ul>

    {#if cacheQuery.hasNextPage}
      <button
        class="btn btn-ghost mt-4 w-full"
        disabled={cacheQuery.isFetchingNextPage}
        onclick={() => cacheQuery.fetchNextPage()}>
        {cacheQuery.isFetchingNextPage ? m.common_loading() : "Charger plus"}
      </button>
    {/if}
  {/if}
</div>

{#if selected}
  <div class="fixed inset-0 z-50 flex justify-end">
    <button
      class="absolute inset-0 cursor-default bg-black/60"
      aria-label={m.common_close()}
      onclick={closeDrawer}></button>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cache-drawer-title"
      class="card relative z-10 flex h-full w-full max-w-sm flex-col overflow-y-auto rounded-none border-y-0 border-r-0 p-5">
      {#if detailQuery.loading}
        <div class="space-y-4">
          <div class="skeleton h-40 rounded-lg"></div>
          <div class="skeleton h-4 w-2/3 rounded"></div>
          <div class="skeleton h-24 rounded-lg"></div>
        </div>
      {:else if detailQuery.error}
        <div class="mb-4 flex items-center justify-between">
          <span class="font-display font-bold">Détail</span>
          <button
            class="text-dim hover:bg-surface-2 hover:text-fg rounded-full p-1.5"
            aria-label={m.common_close()}
            onclick={closeDrawer}>
            <Icon name="x" class="h-5 w-5" />
          </button>
        </div>
        <Banner variant="error">{detailQuery.error}</Banner>
      {:else if detail}
        <div class="mb-5 flex items-start justify-between gap-2">
          <div class="flex min-w-0 items-start gap-3">
            {#if detail.coverUrl}
              <img
                src={detail.coverUrl}
                alt=""
                class="h-24 w-16 shrink-0 rounded object-cover shadow-sm" />
            {:else}
              <div
                class="bg-surface-2 text-dim flex h-24 w-16 shrink-0 items-center justify-center rounded">
                <Icon name={domainIcon(detail.domain)} class="h-6 w-6" />
              </div>
            {/if}
            <div class="min-w-0">
              <h2
                id="cache-drawer-title"
                class="font-display text-lg leading-tight font-bold">
                {detail.title}
              </h2>
              <p class="text-dim mt-1 text-xs">{detail.canonicalSource}</p>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                {#if detail.stale}
                  <span
                    class="border-accent/40 bg-accent/10 text-accent rounded-full border px-2 py-0.5 text-[10px] font-bold">
                    Obsolète
                  </span>
                {/if}
                <span
                  class="border-border text-dim rounded-full border px-2 py-0.5 text-[10px] font-bold">
                  {detail.referenceCount} compte(s)
                </span>
                {#if detail.cachedLocales.length > 1}
                  <span
                    class="border-border text-dim rounded-full border px-2 py-0.5 text-[10px] font-bold">
                    Langues : {detail.cachedLocales.join(", ")}
                  </span>
                {/if}
              </div>
            </div>
          </div>
          <button
            class="text-dim hover:bg-surface-2 hover:text-fg shrink-0 rounded-full p-1.5"
            aria-label={m.common_close()}
            onclick={closeDrawer}>
            <Icon name="x" class="h-5 w-5" />
          </button>
        </div>

        <!-- Informations du cache -->
        <section class="mb-5">
          <h3
            class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
            Informations du cache
            <span class="bg-border h-px flex-1"></span>
          </h3>
          <dl class="space-y-1.5 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-dim">Dernière sync</dt>
              <dd class="timecode text-fg text-right">
                {formatDateTime(detail.lastSyncedAt)}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-dim">Ajouté au cache</dt>
              <dd class="timecode text-right">
                {formatDateTime(detail.createdAt)}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-dim">Dernière modif.</dt>
              <dd class="timecode text-right">
                {formatDateTime(detail.updatedAt)}
              </dd>
            </div>
          </dl>
        </section>

        <!-- Saisons (media) -->
        {#if detail.seasons.length > 0}
          <section class="mb-5">
            <h3
              class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
              Saisons ({detail.seasons.length})
              <span class="bg-border h-px flex-1"></span>
            </h3>
            <ul class="space-y-1 text-sm">
              {#each detail.seasons as s (s.number)}
                <li
                  class="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5">
                  <span class="text-fg truncate">
                    {s.title ?? `Saison ${s.number}`}
                  </span>
                  <span class="timecode shrink-0 text-xs">
                    {s.episodeCount} ép.
                  </span>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        <!-- Identifiants externes -->
        <section class="mb-5">
          <h3
            class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
            Identifiants externes
            <span class="bg-border h-px flex-1"></span>
          </h3>
          <ul class="space-y-1">
            {#each detail.externalIds as ext (ext.source + ext.externalId)}
              <li class="flex items-center justify-between gap-3 text-sm">
                <span class="text-dim">{ext.source}</span>
                <span class="timecode text-fg">{ext.externalId}</span>
              </li>
            {/each}
          </ul>
        </section>

        <!-- Actions -->
        <section class="mt-auto space-y-2 pt-2">
          <a href={detail.detailPath} class="btn btn-ghost w-full">
            Voir la fiche Loomkeep
            <Icon name="chevron-right" class="h-4 w-4" />
          </a>
          <button
            onclick={() => resyncMut.mutate(detail)}
            disabled={resyncMut.loading}
            class="btn btn-primary w-full">
            <Icon
              name="refresh"
              class="h-4 w-4 {resyncMut.loading ? 'animate-spin' : ''}" />
            {resyncMut.loading ? "Re-synchronisation…" : "Re-synchroniser"}
          </button>
          {#if detail.referenceCount === 0}
            <button
              onclick={() => (showDeleteConfirm = true)}
              class="btn btn-danger w-full">
              <Icon name="trash" class="h-4 w-4" />
              Supprimer du cache
            </button>
          {:else}
            <p class="text-dim text-center text-xs">
              Référencé par {detail.referenceCount} compte(s) — non supprimable.
            </p>
          {/if}
        </section>
      {/if}
    </div>
  </div>
{/if}

{#if showDeleteConfirm && detail}
  <ConfirmationModal
    title="Supprimer du cache ?"
    message={`« ${detail.title} » sera retiré du cache. Aucun compte ne le référence, donc rien n'est perdu — il sera re-téléchargé si un utilisateur le rajoute.`}
    confirmLabel={m.common_delete()}
    danger
    busy={deleteItemMut.loading}
    onConfirm={() => deleteItemMut.mutate(detail.title)}
    onCancel={() => (showDeleteConfirm = false)} />
{/if}

{#if showDeleteOrphansConfirm}
  <ConfirmationModal
    title="Purger les orphelins ?"
    message={`Les ${orphanTotal} titre(s) de ce domaine que plus aucun compte ne référence seront retirés du cache. Rien n'est perdu — ils seront re-téléchargés au besoin.`}
    confirmLabel="Purger"
    danger
    busy={deleteOrphansMut.loading}
    onConfirm={() => deleteOrphansMut.mutate()}
    onCancel={() => (showDeleteOrphansConfirm = false)} />
{/if}
