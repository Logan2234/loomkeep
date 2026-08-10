<script lang="ts">
  import { getMyLists } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ListCoverGrid from "$lib/components/ListCoverGrid.svelte";
  import ListFormModal from "$lib/components/ListFormModal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { appConfig } from "$lib/config.svelte";
  import type { ListDto, MyListDto } from "@loomkeep/shared";

  const KIND_LABEL: Record<string, string> = {
    RANKED: "Classement",
    COLLECTION: "Collection",
  };
  const VISIBILITY_LABEL: Record<string, string> = {
    PRIVATE: "Privé",
    FRIENDS: "Amis",
    PUBLIC: "Public",
  };
  const KIND_OPTIONS = [
    { label: "Classement", value: "RANKED" },
    { label: "Collection", value: "COLLECTION" },
  ];
  const VISIBILITY_OPTIONS = [
    { label: "Privé", value: "PRIVATE" },
    { label: "Amis", value: "FRIENDS" },
    { label: "Public", value: "PUBLIC" },
  ];
  const SORT_OPTIONS = [
    { label: "Dernière modification", value: "updatedAt" },
    { label: "Date de création", value: "createdAt" },
    { label: "Nombre d'œuvres", value: "itemCount" },
    { label: "Nom", value: "title" },
  ];
  type SortKey = "updatedAt" | "createdAt" | "itemCount" | "title";

  let lists = $state<MyListDto[]>([]);
  let loading = $state(true);
  let creating = $state(false);

  let query = $state("");
  let kindFilter = $state<string[]>([]);
  let visibilityFilter = $state<string[]>([]);
  let sort = $state<SortKey>("updatedAt");

  $effect(() => {
    getMyLists()
      .then((r) => (lists = r))
      .finally(() => (loading = false));
  });

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    let out = lists;
    if (q) out = out.filter((l) => l.title.toLowerCase().includes(q));
    if (kindFilter.length > 0)
      out = out.filter((l) => kindFilter.includes(l.kind));
    if (visibilityFilter.length > 0)
      out = out.filter((l) => visibilityFilter.includes(l.visibility));

    return [...out].sort((a, b) => {
      switch (sort) {
        case "createdAt":
          return b.createdAt.localeCompare(a.createdAt);
        case "itemCount":
          return b.itemCount - a.itemCount;
        case "title":
          return a.title.localeCompare(b.title, "fr");
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
  });

  function handleCreated(list: ListDto) {
    // Newest-updated first, matches the server order for a fresh list.
    lists = [{ ...list, itemCount: 0, previewImageUrls: [] }, ...lists];
  }
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:py-8">
  <PageHeader
    icon="list"
    title="Mes listes"
    subtitle="Vos classements et collections, tous domaines confondus." />

  {#if !loading && lists.length > 0}
    <div class="relative mb-4">
      <span
        class="text-dim pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <Icon name="search" class="h-5 w-5" />
      </span>
      <input
        type="search"
        placeholder="Chercher une liste…"
        bind:value={query}
        class="input pl-10" />
    </div>

    <div
      class="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div class="flex flex-wrap items-center gap-2">
        <Combobox
          label="Type"
          multiselect
          options={KIND_OPTIONS}
          values={kindFilter}
          onChange={(v) => (kindFilter = v)} />
        {#if appConfig.socialEnabled}
          <Combobox
            label="Visibilité"
            multiselect
            options={VISIBILITY_OPTIONS}
            values={visibilityFilter}
            onChange={(v) => (visibilityFilter = v)} />
        {/if}
      </div>
      <div class="sm:ml-auto">
        <Combobox
          label="Trier"
          options={SORT_OPTIONS}
          values={[sort]}
          onChange={(v) => (sort = (v[0] as SortKey) ?? sort)} />
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {#each Array(4) as _, i (i)}
        <div class="skeleton aspect-2/3 w-full rounded-xl"></div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      <button
        type="button"
        class="border-border text-dim hover:border-accent hover:text-accent group aspect-2/3 w-full rounded-xl border border-dashed transition-colors"
        onclick={() => (creating = true)}>
        <span class="flex h-full flex-col items-center justify-center gap-1.5">
          <Icon name="plus" class="h-6 w-6" />
          <span class="text-xs font-semibold">Créer une liste</span>
        </span>
      </button>

      {#each filtered as list (list.id)}
        <a href="/app/lists/{list.id}" class="group">
          <div
            class="card group-hover:border-accent overflow-hidden transition-colors">
            <ListCoverGrid images={list.previewImageUrls} title={list.title} />
          </div>
          <p class="mt-1.5 truncate text-sm font-semibold">{list.title}</p>
          <p class="text-dim flex flex-wrap items-center gap-x-1.5 text-xs">
            <span class="timecode uppercase">{KIND_LABEL[list.kind]}</span>
            <span aria-hidden="true">·</span>
            <span
              >{list.itemCount} {list.itemCount > 1 ? "œuvres" : "œuvre"}</span>
            {#if appConfig.socialEnabled}
              <span aria-hidden="true">·</span>
              <span>{VISIBILITY_LABEL[list.visibility]}</span>
            {/if}
          </p>
        </a>
      {/each}
    </div>

    {#if lists.length > 0 && filtered.length === 0}
      <p class="text-dim mt-8 text-center text-sm">
        Aucune liste ne correspond à ces filtres.
      </p>
    {/if}
  {/if}
</div>

{#if creating}
  <ListFormModal
    defaultVisibility={auth.user?.defaultListVisibility ?? "PRIVATE"}
    onClose={() => (creating = false)}
    onSaved={handleCreated} />
{/if}
