<script module lang="ts">
  export interface LibraryLoadParams {
    query: string;
    statuses: string[];
    favoritesOnly: boolean;
    /** The domain's extra filter value (media's type list), opaque here. */
    extra: unknown;
    sort: string;
    order: "asc" | "desc";
    /** 1-indexed. */
    page: number;
  }
</script>

<script lang="ts" generics="T">
  // Generic library browser shared by the games / books / media / music list
  // pages: server-paginated infinite scroll (mirrors MediaSearchPanel's
  // debounce + sentinel pattern), text filter, status multi-select, favorites
  // toggle, sort + direction, loading states, the three empty states and the
  // poster grid. Filtering/sorting itself happens server-side (see each
  // domain's `listEntries`); everything domain-specific (labels, card markup,
  // the actual `load` call, and media's extra "type" filter) is injected via
  // props/snippets.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PosterGrid from "$lib/components/PosterGrid.svelte";
  import PosterGridSkeleton from "$lib/components/PosterGridSkeleton.svelte";
  import { debounce } from "$lib/debounce";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { Domain, MediaType, PagedResult } from "@loomkeep/shared";
  import type { ComponentProps, Snippet } from "svelte";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";

  type IconName = ComponentProps<typeof Icon>["name"];

  interface Option {
    label: string;
    value: string;
  }

  let {
    icon,
    title,
    subtitle,
    noun,
    domain,
    load,
    keyOf,
    statusOptions,
    sorts,
    defaultSort,
    card,
    catalogPreview,
    headerActions,
  }: {
    icon: IconName;
    title: string;
    /** Header subtitle, e.g. `(n) => "3 livres"`. */
    subtitle: (count: number) => string;
    /** Masculine noun for the empty-state copy: "livre", "jeu", "titre". */
    noun: string;
    /** This library's domain, to preselect the right tab on /search. */
    domain: Domain;
    load: (params: LibraryLoadParams) => Promise<PagedResult<T>>;
    /** Stable key for the poster grid's keyed each. */
    keyOf: (entry: T) => string;
    statusOptions: Option[];
    sorts: Option[];
    defaultSort: string;
    card: Snippet<[T]>;
    /** Renders a capped catalogue-search preview for the current query, when a
     * library search comes up empty (no filters). Receives the trimmed query
     * and a callback to report back how many catalogue results it found. */
    catalogPreview?: Snippet<[string, (count: number) => void]>;
    /** Rendered beside the title, e.g. books' reading-goal chip. */
    headerActions?: Snippet;
  } = $props();

  // Result count reported by `catalogPreview`, reset whenever the query
  // changes so a stale count never lingers across searches.
  let previewCount = $state<number | null>(null);

  // Seeded from the URL so a filtered/sorted view survives a real browser
  // back navigation (the page that navigated away last kept the URL in sync
  // via `replaceState`, see `syncUrl` below).
  const initialParams = page.url.searchParams;

  let statuses = $state<string[]>(
    initialParams.get("status")?.split(",").filter(Boolean) ?? [],
  );
  let favoritesOnly = $state(initialParams.get("fav") === "1");
  let sort = $state<string>(initialParams.get("sort") ?? defaultSort);
  let reversed = $state(initialParams.get("order") === "asc");
  // `query` is the raw input; `queryFilter` is the debounced value that
  // actually drives the fetch (see the input's oninput below).
  let query = $state(initialParams.get("q") ?? "");
  let queryFilter = $state(initialParams.get("q") ?? "");

  let sentinel = $state<HTMLElement | null>(null);

  // Extra "type" filter, owned by the page and passed to LibraryBrowser.
  let types = $state<MediaType[]>(
    (initialParams.get("type")?.split(",").filter(Boolean) as MediaType[]) ??
      [],
  );

  const reduced = prefersReducedMotion();

  const debouncedQueryFilter = debounce(() => {
    queryFilter = query.trim();
  }, 300);

  const TYPE_OPTIONS: { label: string; value: MediaType }[] = [
    { label: m.media_movies(), value: "MOVIE" },
    { label: m.media_series_plural(), value: "SERIES" },
    { label: m.media_anime(), value: "ANIME" },
  ];

  // Mirrors the current filters/sort/query into the URL so navigating back
  // here — either the browser's back button or a page's "← retour" link —
  // restores this view instead of resetting to defaults. Uses `goto` rather
  // than the shallow-routing `replaceState` from $app/navigation: the latter
  // only patches the raw history entry without updating SvelteKit's own
  // router state, so `page.url` (and therefore the filters read back from it)
  // stays stale when the browser later navigates back to that entry.
  function syncUrl() {
    const params = new URLSearchParams();
    if (queryFilter) params.set("q", queryFilter);
    if (statuses.length) params.set("status", statuses.join(","));
    if (favoritesOnly) params.set("fav", "1");
    if (types.length) params.set("type", types.join(","));
    if (sort !== defaultSort) params.set("sort", sort);
    if (reversed) params.set("order", "asc");
    const qs = params.toString();
    void goto(qs ? `?${qs}` : page.url.pathname, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }

  $effect(() => {
    // Tracked: queryFilter, statuses, favoritesOnly, types, sort, reversed.
    syncUrl();
  });

  const browseKey = $derived(
    keys.library.browse(domain, {
      query: queryFilter,
      statuses,
      favoritesOnly,
      extra: types,
      sort,
      order: reversed ? "asc" : "desc",
    }),
  );

  const browseQuery = createApiInfiniteQuery<PagedResult<T>, number, T>(() => ({
    key: browseKey,
    fetch: (pageNum) =>
      load({
        query: queryFilter,
        statuses,
        favoritesOnly,
        extra: types,
        sort,
        order: reversed ? "asc" : "desc",
        page: pageNum,
      }),
    getPageItems: (p) => p.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
    keepPreviousData: true,
  }));

  const items = $derived(browseQuery.data);
  const error = $derived(browseQuery.error);
  const total = $derived(browseQuery.pages.at(-1)?.total ?? 0);
  const loading = $derived(browseQuery.loading);
  const loadingMore = $derived(browseQuery.isFetchingNextPage);

  let showSkeleton = $state(false);
  $effect(() => {
    if (!loading || items.length > 0) {
      showSkeleton = false;
      return;
    }
    const timer = setTimeout(() => (showSkeleton = true), 200);
    return () => clearTimeout(timer);
  });

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  $effect(() => {
    const el = sentinel;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) browseQuery.fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  });

  const hasQuery = $derived(query.trim() !== "");
  const hasFilters = $derived(
    statuses.length > 0 || favoritesOnly || types.length > 0,
  );

  function clearFilters() {
    statuses = [];
    favoritesOnly = false;
    types = [];
  }
</script>

<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    {icon}
    {title}
    subtitle={subtitle(total)}
    actions={headerActions}
    class="mb-6" />

  <div class="relative mb-4">
    <span
      class="text-dim pointer-events-none absolute inset-y-0 left-3 flex items-center">
      <Icon name="search" class="h-5 w-5" />
    </span>
    <input
      type="search"
      placeholder={m.library_filter_placeholder()}
      value={query}
      oninput={(e) => {
        query = e.currentTarget.value;
        previewCount = null;
        debouncedQueryFilter.call();
      }}
      class="input pl-10" />
  </div>

  <div
    class="mb-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
    <div class="flex flex-wrap items-center gap-2">
      {#if domain === "MEDIA"}
        <Combobox
          label={m.common_type()}
          multiselect
          options={TYPE_OPTIONS}
          values={types}
          onChange={(v) => (types = v as MediaType[])} />
      {/if}
      <Combobox
        label={m.common_status()}
        multiselect
        options={statusOptions}
        values={statuses}
        onChange={(v) => (statuses = v)} />
      <button
        class="chip inline-flex items-center gap-1"
        class:chip-on={favoritesOnly}
        onclick={() => (favoritesOnly = !favoritesOnly)}>
        <Icon name="star" class="h-3.5 w-3.5" />&nbsp;
        {m.common_favorites()}
      </button>
    </div>
    <div class="flex items-center gap-2 sm:ml-auto">
      <Combobox
        label={m.common_sort()}
        options={sorts}
        values={[sort]}
        onChange={(v) => (sort = v[0] ?? sort)} />
      <button
        type="button"
        class="chip px-2.5 font-mono"
        title={reversed ? m.common_sort_reversed() : m.common_sort_default()}
        aria-label={m.common_reverse_sort()}
        onclick={() => (reversed = !reversed)}>
        {reversed ? "↑" : "↓"}
      </button>
    </div>
  </div>

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if showSkeleton}
    <PosterGridSkeleton />
  {:else if items.length === 0 && hasQuery && !hasFilters && !loading}
    <!-- No local match: a live catalogue preview instead of only a link out
         to /search — `previewCount` (reported by the panel) decides whether
         we're still waiting, have suggestions, or truly found nothing. -->
    {#if catalogPreview}
      {#if previewCount === 0}
        <p class="text-dim py-10 text-center text-sm">
          {m.library_empty_search_catalog({ noun, query: query.trim() })}
        </p>
      {:else if previewCount !== null}
        <p class="text-dim mb-3 text-xs font-semibold tracking-wide uppercase">
          {m.library_catalog_suggestions()}
        </p>
      {/if}
      {@render catalogPreview(query.trim(), (n) => (previewCount = n))}
      {#if previewCount !== null && previewCount > 0}
        <div class="mt-4 text-center">
          <a
            href={`/app/search?query=${encodeURIComponent(query.trim())}&type=${domain}`}
            class="btn btn-ghost">
            {m.library_catalog_more()}
            <Icon name="chevron-right" class="h-4 w-4" />
          </a>
        </div>
      {/if}
    {:else}
      <p class="text-dim py-10 text-center text-sm">
        {m.library_empty_search({ noun, query: query.trim() })}
      </p>
    {/if}
  {:else if items.length === 0 && !loading}
    <div in:fade|global={{ duration: reduced ? 0 : 150 }}>
      <EmptyState>
        {#if !hasFilters && !hasQuery}
          <p>{m.library_empty_domain({ noun })}</p>
          <a href={`/app/search?type=${domain}`} class="btn btn-primary mt-4">
            <Icon name="search" class="h-4 w-4" />
            {domain === "MUSIC"
              ? m.library_search_album()
              : m.library_search_noun({ noun })}
          </a>
        {:else}
          <p>
            {#if hasQuery}
              {m.library_empty_filters_query({ noun, query: query.trim() })}
            {:else}
              {m.library_empty_filters({ noun })}
            {/if}
          </p>
          <button class="btn btn-ghost mt-4" onclick={clearFilters}>
            {m.common_clear_filters()}
          </button>
        {/if}
      </EmptyState>
    </div>
  {:else if items.length > 0}
    <PosterGrid>
      {#each items as entry (keyOf(entry))}
        <div
          animate:flip={{ duration: reduced ? 0 : 250 }}
          in:fade|global={{ duration: reduced ? 0 : 150 }}>
          {@render card(entry)}
        </div>
      {/each}
    </PosterGrid>
    {#if browseQuery.hasNextPage}
      <!-- Sentinel: entering the viewport triggers the next page. -->
      <div bind:this={sentinel} class="absolute h-10"></div>
    {/if}
    {#if loadingMore}
      <div class="mt-4">
        <PosterGridSkeleton count={5} />
      </div>
    {/if}
  {/if}
</div>
