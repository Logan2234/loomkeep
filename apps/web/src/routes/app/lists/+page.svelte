<script lang="ts">
  import { getEditableLists } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ListCoverGrid from "$lib/components/ListCoverGrid.svelte";
  import ListFormModal from "$lib/components/ListFormModal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { getLocale } from "$lib/paraglide/runtime.js";
  import { useQueryClient } from "@tanstack/svelte-query";

  const KIND_LABEL: Record<string, string> = {
    RANKED: m.lists_kind_ranked(),
    COLLECTION: m.lists_kind_collection(),
  };
  const VISIBILITY_LABEL: Record<string, string> = {
    PRIVATE: m.common_private(),
    FRIENDS: m.common_friends(),
    PUBLIC: m.common_public(),
  };
  const KIND_OPTIONS = [
    { label: m.lists_kind_ranked(), value: "RANKED" },
    { label: m.lists_kind_collection(), value: "COLLECTION" },
  ];
  const VISIBILITY_OPTIONS = [
    { label: m.common_private(), value: "PRIVATE" },
    { label: m.common_friends(), value: "FRIENDS" },
    { label: m.common_public(), value: "PUBLIC" },
  ];
  const SORT_OPTIONS = [
    { label: m.lists_sort_updated(), value: "updatedAt" },
    { label: m.lists_sort_created(), value: "createdAt" },
    { label: m.lists_sort_count(), value: "itemCount" },
    { label: m.common_name(), value: "title" },
  ];
  type SortKey = "updatedAt" | "createdAt" | "itemCount" | "title";

  const listsQuery = createApiQuery(() => ({
    key: keys.lists.editable(),
    fetch: getEditableLists,
  }));
  const lists = $derived(listsQuery.data ?? []);
  const loading = $derived(listsQuery.loading);
  let creating = $state(false);

  let query = $state("");
  let kindFilter = $state<string[]>([]);
  let visibilityFilter = $state<string[]>([]);
  let sort = $state<SortKey>("updatedAt");

  const queryClient = useQueryClient();

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
          return a.title.localeCompare(b.title, getLocale());
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
  });

  function handleCreated() {
    void queryClient.invalidateQueries({ queryKey: keys.lists.editable() });
  }
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:py-8">
  <PageHeader
    icon="list"
    title={m.lists_title()}
    subtitle={m.lists_subtitle()} />

  {#if !loading && lists.length > 0}
    <div class="relative mb-4">
      <span
        class="text-dim pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <Icon name="search" class="h-5 w-5" />
      </span>
      <input
        type="search"
        placeholder={m.lists_search_placeholder()}
        bind:value={query}
        class="input pl-10" />
    </div>

    <div
      class="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div class="flex flex-wrap items-center gap-2">
        <Combobox
          label={m.lists_kind_label()}
          multiselect
          options={KIND_OPTIONS}
          values={kindFilter}
          onChange={(v) => (kindFilter = v)} />
        {#if appConfig.socialEnabled}
          <Combobox
            label={m.lists_visibility()}
            multiselect
            options={VISIBILITY_OPTIONS}
            values={visibilityFilter}
            onChange={(v) => (visibilityFilter = v)} />
        {/if}
      </div>
      <div class="sm:ml-auto">
        <Combobox
          label={m.common_sort()}
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
          <span class="text-xs font-semibold">{m.lists_create_button()}</span>
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
              >{list.itemCount}
              {list.itemCount > 1
                ? m.lists_works_plural()
                : m.lists_works_singular()}</span>
            {#if appConfig.socialEnabled}
              <span aria-hidden="true">·</span>
              <span>{VISIBILITY_LABEL[list.visibility]}</span>
            {/if}
            {#if list.role === "EDITOR"}
              <span aria-hidden="true">·</span>
              <span
                >{m.list_owned_by_editor({
                  name: list.author.displayName,
                })}</span>
            {/if}
          </p>
        </a>
      {/each}
    </div>

    {#if lists.length > 0 && filtered.length === 0}
      <p class="text-dim mt-8 text-center text-sm">
        {m.lists_empty_filter()}
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
