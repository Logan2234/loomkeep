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
  import { ApiError } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PosterGrid from "$lib/components/PosterGrid.svelte";
  import PosterGridSkeleton from "$lib/components/PosterGridSkeleton.svelte";
  import { debounce } from "$lib/debounce";
  import { m } from "$lib/paraglide/messages.js";
  import type { Domain, MediaType, PagedResult } from "@loomkeep/shared";
  import type { ComponentProps, Snippet } from "svelte";

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

  let items = $state<T[]>([]);
  let total = $state(0);
  let statuses = $state<string[]>([]);
  let favoritesOnly = $state(false);
  let sort = $state<string>(defaultSort);
  let reversed = $state(false);
  let query = $state("");
  let loading = $state(true); // fetching the first page for the current filters
  let loadingMore = $state(false); // fetching a follow-up page (infinite scroll)
  let done = $state(false); // no more pages for the current filters
  let error = $state<string | null>(null);

  let sentinel = $state<HTMLElement | null>(null);

  // Extra "type" filter, owned by the page and passed to LibraryBrowser.
  let types = $state<MediaType[]>([]);

  // Non-reactive bookkeeping.
  let lastPage = 0;
  let loadId = 0; // bumped on every reset; stale responses are discarded
  const debouncedRun = debounce(() => run(true), 300);

  const TYPE_OPTIONS: { label: string; value: MediaType }[] = [
    { label: "Films", value: "MOVIE" },
    { label: "Séries", value: "SERIES" },
    { label: "Animés", value: "ANIME" },
  ];

  async function run(reset: boolean): Promise<void> {
    if (!reset && (loading || loadingMore || done)) return;

    if (reset) {
      loadId++;
      lastPage = 0;
      done = false;
      items = [];
    }
    const mine = loadId;
    const next = lastPage + 1;
    if (reset) loading = true;
    else loadingMore = true;
    error = null;

    try {
      const result = await load({
        query: query.trim(),
        statuses,
        favoritesOnly,
        extra: types,
        sort,
        order: reversed ? "asc" : "desc",
        page: next,
      });
      if (mine !== loadId) return; // a newer load superseded this one
      lastPage = next;
      total = result.total;
      items = reset ? result.items : [...items, ...result.items];
      done = !result.hasMore;
    } catch (err) {
      if (mine !== loadId) return;
      error =
        err instanceof ApiError ? err.message : m.common_fetch_error_fallback();
    } finally {
      if (mine === loadId) {
        loading = false;
        loadingMore = false;
      }
    }
  }

  // The only filter not driven by a local handler below: media's "type" list
  // lives on the page, not here. Also doubles as the initial load on mount.
  $effect(() => {
    void types;
    void run(true);
  });

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  $effect(() => {
    const el = sentinel;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void run(false);
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
    void run(true);
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
      placeholder="Filtrer ma bibliothèque…"
      value={query}
      oninput={(e) => {
        query = e.currentTarget.value;
        previewCount = null;
        debouncedRun.call();
      }}
      class="input pl-10" />
  </div>

  <div
    class="mb-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
    <div class="flex flex-wrap items-center gap-2">
      {#if domain === "MEDIA"}
        <Combobox
          label="Type"
          multiselect
          options={TYPE_OPTIONS}
          values={types}
          onChange={(v) => (types = v as MediaType[])} />
      {/if}
      <Combobox
        label="Statut"
        multiselect
        options={statusOptions}
        values={statuses}
        onChange={(v) => {
          statuses = v;
          void run(true);
        }} />
      <button
        class="chip inline-flex items-center gap-1"
        class:chip-on={favoritesOnly}
        onclick={() => {
          favoritesOnly = !favoritesOnly;
          void run(true);
        }}>
        <Icon name="star" class="h-3.5 w-3.5" /> Favoris
      </button>
    </div>
    <div class="flex items-center gap-2 sm:ml-auto">
      <Combobox
        label="Trier"
        options={sorts}
        values={[sort]}
        onChange={(v) => {
          sort = v[0] ?? sort;
          void run(true);
        }} />
      <button
        type="button"
        class="chip px-2.5 font-mono"
        title={reversed ? "Ordre inversé" : "Ordre par défaut"}
        aria-label="Inverser le sens du tri"
        onclick={() => {
          reversed = !reversed;
          void run(true);
        }}>
        {reversed ? "↑" : "↓"}
      </button>
    </div>
  </div>

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if loading}
    <PosterGridSkeleton />
  {:else if items.length === 0 && hasQuery && !hasFilters}
    <!-- No local match: a live catalogue preview instead of only a link out
         to /search — `previewCount` (reported by the panel) decides whether
         we're still waiting, have suggestions, or truly found nothing. -->
    {#if catalogPreview}
      {#if previewCount === 0}
        <p class="text-dim py-10 text-center text-sm">
          Aucun {noun} ne correspond à « {query.trim()} », ni dans ta bibliothèque
          ni dans le catalogue.
        </p>
      {:else if previewCount !== null}
        <p class="text-dim mb-3 text-xs font-semibold tracking-wide uppercase">
          Suggestions du catalogue — pas encore dans ta bibliothèque
        </p>
      {/if}
      {@render catalogPreview(query.trim(), (n) => (previewCount = n))}
      {#if previewCount !== null && previewCount > 0}
        <div class="mt-4 text-center">
          <a
            href={`/app/search?query=${encodeURIComponent(query.trim())}&type=${domain}`}
            class="btn btn-ghost">
            Voir plus dans le catalogue <Icon
              name="chevron-right"
              class="h-4 w-4" />
          </a>
        </div>
      {/if}
    {:else}
      <p class="text-dim py-10 text-center text-sm">
        Aucun {noun} ne correspond à « {query.trim()} » dans ta bibliothèque.
      </p>
    {/if}
  {:else if items.length === 0}
    <EmptyState>
      {#if !hasFilters && !hasQuery}
        <p>Tu n'as encore aucun {noun} dans ta bibliothèque.</p>
        <a href={`/app/search?type=${domain}`} class="btn btn-primary mt-4">
          <Icon name="search" class="h-4 w-4" /> Chercher un {noun}
        </a>
      {:else}
        <p>
          {#if hasQuery}
            Aucun {noun} ne correspond à ces filtres pour « {query.trim()} ».
          {:else}
            Aucun {noun} ne correspond à ces filtres.
          {/if}
        </p>
        <button class="btn btn-ghost mt-4" onclick={clearFilters}>
          Effacer les filtres
        </button>
      {/if}
    </EmptyState>
  {:else}
    <PosterGrid>
      {#each items as entry (keyOf(entry))}
        {@render card(entry)}
      {/each}
    </PosterGrid>
    {#if !done}
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
