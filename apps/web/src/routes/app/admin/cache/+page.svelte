<script lang="ts">
  import {
    deleteAdminCacheItem,
    deleteAdminCacheOrphans,
    getAdminCache,
    getAdminCacheItem,
    resyncAdminCacheItem,
    resyncAdminCacheStale,
  } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
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
    AdminCacheItemDetailDto,
    AdminCacheItemDto,
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
  let items = $state<AdminCacheItemDto[]>([]);
  let total = $state(0);
  let staleTotal = $state(0);
  let orphanTotal = $state(0);
  let page = $state(1);
  let loading = $state(false);
  let error = $state("");

  let resyncing = $state<string | null>(null);
  let bulkResyncing = $state(false);
  let bulkDeleting = $state(false);
  let showDeleteOrphansConfirm = $state(false);

  // --- detail drawer ---
  let selectedId = $state<string | null>(null);
  let detail = $state<AdminCacheItemDetailDto | null>(null);
  let detailLoading = $state(false);
  let detailError = $state("");
  let drawerResyncing = $state(false);

  // --- single delete ---
  let showDeleteConfirm = $state(false);
  let deleting = $state(false);

  const hasMore = $derived(items.length < total);

  async function load(reset: boolean) {
    loading = true;
    error = "";
    const targetPage = reset ? 1 : page + 1;
    try {
      const res = await getAdminCache({
        domain: activeDomain,
        search: search || undefined,
        sort,
        orphans: orphansOnly || undefined,
        page: targetPage,
      });
      items = reset ? res.items : [...items, ...res.items];
      total = res.total;
      staleTotal = res.staleTotal;
      orphanTotal = res.orphanTotal;
      page = targetPage;
    } catch (err) {
      error = resolveApiError(err);
    } finally {
      loading = false;
    }
  }

  function selectDomain(domain: Domain) {
    activeDomain = domain;
    void load(true);
  }

  function selectSort(next: AdminCacheSort) {
    sort = next;
    void load(true);
  }

  function toggleOrphans() {
    orphansOnly = !orphansOnly;
    void load(true);
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  function onSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      search = searchInput.trim();
      void load(true);
    }, 300);
  }

  $effect(() => {
    void load(true);
  });

  /** Reload the current view in place (after a mutation), keeping filters/sort. */
  async function refreshInPlace() {
    try {
      const res = await getAdminCache({
        domain: activeDomain,
        search: search || undefined,
        sort,
        orphans: orphansOnly || undefined,
        page: 1,
      });
      items = res.items;
      total = res.total;
      staleTotal = res.staleTotal;
      orphanTotal = res.orphanTotal;
      page = 1;
    } catch {
      // Non-fatal: the mutation already succeeded, only the view is stale.
    }
  }

  async function resync(item: AdminCacheItemDto, e?: MouseEvent) {
    e?.stopPropagation();
    resyncing = item.id;
    error = "";
    try {
      await resyncAdminCacheItem(item.domain, item.id);
      await refreshInPlace();
      toast.success(`« ${item.title} » re-synchronisé.`);
    } catch (err) {
      error = resolveApiError(err);
    } finally {
      resyncing = null;
    }
  }

  async function bulkResync() {
    bulkResyncing = true;
    error = "";
    try {
      const res = await resyncAdminCacheStale(activeDomain);
      await refreshInPlace();
      toast.success(
        res.failed > 0
          ? `${res.resynced} re-synchronisé(s), ${res.failed} en échec.`
          : `${res.resynced} titre(s) re-synchronisé(s).`,
      );
    } catch (err) {
      error = resolveApiError(err);
    } finally {
      bulkResyncing = false;
    }
  }

  async function confirmDeleteOrphans() {
    bulkDeleting = true;
    error = "";
    try {
      const res = await deleteAdminCacheOrphans(activeDomain);
      showDeleteOrphansConfirm = false;
      await refreshInPlace();
      toast.success(
        res.skipped > 0
          ? `${res.deleted} orphelin(s) supprimé(s) du cache — ${res.skipped} laissé(s) car référencé(s) par une critique, un commentaire ou une activité.`
          : `${res.deleted} orphelin(s) supprimé(s) du cache.`,
      );
    } catch (err) {
      error = resolveApiError(err);
      showDeleteOrphansConfirm = false;
    } finally {
      bulkDeleting = false;
    }
  }

  async function openDetail(item: AdminCacheItemDto) {
    selectedId = item.id;
    detail = null;
    detailError = "";
    detailLoading = true;
    try {
      detail = await getAdminCacheItem(item.domain, item.id);
    } catch (err) {
      detailError = resolveApiError(err);
    } finally {
      detailLoading = false;
    }
  }

  function closeDrawer() {
    selectedId = null;
    detail = null;
    showDeleteConfirm = false;
  }

  async function drawerResync() {
    if (!detail) return;
    drawerResyncing = true;
    try {
      await resyncAdminCacheItem(detail.domain, detail.id);
      detail = await getAdminCacheItem(detail.domain, detail.id);
      await refreshInPlace();
      toast.success("Re-synchronisé.");
    } catch (err) {
      detailError = resolveApiError(err);
    } finally {
      drawerResyncing = false;
    }
  }

  async function confirmDelete() {
    if (!detail) return;
    deleting = true;
    try {
      const title = detail.title;
      await deleteAdminCacheItem(detail.domain, detail.id);
      items = items.filter((i) => i.id !== detail!.id);
      total = Math.max(0, total - 1);
      showDeleteConfirm = false;
      closeDrawer();
      toast.success(`« ${title} » supprimé du cache.`);
    } catch (err) {
      detailError = resolveApiError(err);
      showDeleteConfirm = false;
    } finally {
      deleting = false;
    }
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && selectedId && !showDeleteConfirm) closeDrawer();
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
        onclick={bulkResync}
        disabled={bulkResyncing || staleTotal === 0}
        class="btn btn-ghost btn-sm">
        <Icon
          name="refresh"
          class="h-3.5 w-3.5 {bulkResyncing ? 'animate-spin' : ''}" />
        Re-sync obsolètes ({staleTotal})
      </button>
      <button
        onclick={() => (showDeleteOrphansConfirm = true)}
        disabled={bulkDeleting || orphanTotal === 0}
        class="btn btn-danger btn-sm">
        <Icon name="trash" class="h-3.5 w-3.5" />
        Supprimer orphelins ({orphanTotal})
      </button>
    </div>
  </div>

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if loading && items.length === 0}
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
          class="card hover:bg-surface-2 flex items-center gap-3 p-3 transition-colors {selectedId ===
          item.id
            ? 'ring-accent ring-1'
            : ''}">
          <button
            type="button"
            onclick={() => openDetail(item)}
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
            onclick={(e) => resync(item, e)}
            disabled={resyncing === item.id}
            aria-label="Re-synchroniser {item.title}"
            class="btn btn-ghost btn-sm shrink-0">
            <Icon
              name="refresh"
              class="h-3.5 w-3.5 {resyncing === item.id
                ? 'animate-spin'
                : ''}" />
            <span class="hidden sm:inline">Re-sync</span>
          </button>
        </li>
      {/each}
    </ul>

    {#if hasMore}
      <button
        class="btn btn-ghost mt-4 w-full"
        disabled={loading}
        onclick={() => load(false)}>
        {loading ? m.common_loading() : "Charger plus"}
      </button>
    {/if}
  {/if}
</div>

{#if selectedId}
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
      {#if detailLoading}
        <div class="space-y-4">
          <div class="skeleton h-40 rounded-lg"></div>
          <div class="skeleton h-4 w-2/3 rounded"></div>
          <div class="skeleton h-24 rounded-lg"></div>
        </div>
      {:else if detailError}
        <div class="mb-4 flex items-center justify-between">
          <span class="font-display font-bold">Détail</span>
          <button
            class="text-dim hover:bg-surface-2 hover:text-fg rounded-full p-1.5"
            aria-label={m.common_close()}
            onclick={closeDrawer}>
            <Icon name="x" class="h-5 w-5" />
          </button>
        </div>
        <Banner variant="error">{detailError}</Banner>
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
            onclick={drawerResync}
            disabled={drawerResyncing}
            class="btn btn-primary w-full">
            <Icon
              name="refresh"
              class="h-4 w-4 {drawerResyncing ? 'animate-spin' : ''}" />
            {drawerResyncing ? "Re-synchronisation…" : "Re-synchroniser"}
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
    busy={deleting}
    onConfirm={confirmDelete}
    onCancel={() => (showDeleteConfirm = false)} />
{/if}

{#if showDeleteOrphansConfirm}
  <ConfirmationModal
    title="Purger les orphelins ?"
    message={`Les ${orphanTotal} titre(s) de ce domaine que plus aucun compte ne référence seront retirés du cache. Rien n'est perdu — ils seront re-téléchargés au besoin.`}
    confirmLabel="Purger"
    danger
    busy={bulkDeleting}
    onConfirm={confirmDeleteOrphans}
    onCancel={() => (showDeleteOrphansConfirm = false)} />
{/if}
