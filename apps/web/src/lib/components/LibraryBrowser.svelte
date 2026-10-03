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

  /** The list's filters without its order: what a pile is summed over. */
  export type PileLoadParams = Omit<
    LibraryLoadParams,
    "sort" | "order" | "page"
  >;
</script>

<script lang="ts" generics="T extends { favorite: boolean }">
  // Generic library browser shared by the games / books / media / music list
  // pages: server-paginated infinite scroll (mirrors MediaSearchPanel's
  // debounce + sentinel pattern), text filter, status multi-select, favorites
  // toggle, sort + direction, loading states, the three empty states and the
  // results in the mode picked from the "Affichage" menu (cards, table, wall,
  // compact). Filtering/sorting itself happens server-side (see each domain's
  // `listEntries`); everything domain-specific (labels, card markup, the
  // table's columns, the actual `load` call, and media's extra "type"
  // filter) is injected via props/snippets.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { resolveApiError } from "$lib/api/errors";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import LibraryBulkBar from "$lib/components/LibraryBulkBar.svelte";
  import LibraryReviewEditor from "$lib/components/LibraryReviewEditor.svelte";
  import LibraryTable from "$lib/components/LibraryTable.svelte";
  import LibraryViewMenu from "$lib/components/LibraryViewMenu.svelte";
  import LibraryWall from "$lib/components/LibraryWall.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PosterGrid from "$lib/components/PosterGrid.svelte";
  import PosterGridSkeleton from "$lib/components/PosterGridSkeleton.svelte";
  import SavedViewBar from "$lib/components/SavedViewBar.svelte";
  import { debounce } from "$lib/debounce";
  import {
    readLibraryColumns,
    readLibraryViewMode,
    writeLibraryColumns,
    writeLibraryViewMode,
    type LibraryBulkActions,
    type LibraryColumn,
    type LibraryInlineEdit,
    type LibraryItemView,
    type LibrarySelection,
    type LibraryViewMode,
  } from "$lib/library-view";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { pileHeaderLabel } from "$lib/pile";
  import { filtersToSearchParams } from "$lib/saved-views";
  import { toast } from "$lib/toast.svelte";
  import type {
    BulkEntriesResultDto,
    BulkEntriesTargetDto,
    BulkUpdateEntriesDto,
    MediaType,
    PagedResult,
    PileSummaryDto,
    SavedViewDomain,
    SavedViewFiltersDto,
  } from "@loomkeep/shared";
  import type { ComponentProps, Snippet } from "svelte";
  import { useQueryClient, type InfiniteData } from "@tanstack/svelte-query";
  import { onDestroy, untrack } from "svelte";
  import { flip } from "svelte/animate";
  import { MediaQuery, SvelteSet } from "svelte/reactivity";
  import { fade, fly, scale, slide } from "svelte/transition";

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
    loadPile,
    keyOf,
    statusOptions,
    sorts,
    defaultSort,
    card,
    itemView,
    columns,
    catalogPreview,
    headerActions,
    bulk,
    setFavorite,
  }: {
    icon: IconName;
    title: string;
    /** Header subtitle, e.g. `(n) => "3 livres"`. */
    subtitle: (count: number) => string;
    /** Masculine noun for the empty-state copy: "livre", "jeu", "titre". */
    noun: string;
    /** This library's domain: its saved views, and the tab to preselect on /search. */
    domain: SavedViewDomain;
    load: (params: LibraryLoadParams) => Promise<PagedResult<T>>;
    /** What's left in the pile under the same filters, for the header. */
    loadPile?: (params: PileLoadParams) => Promise<PileSummaryDto>;
    /** Stable key for the poster grid's keyed each. */
    keyOf: (entry: T) => string;
    statusOptions: Option[];
    sorts: Option[];
    defaultSort: string;
    /** Gets the toggle the card's favorite star should call. */
    card: Snippet<[T, (next: boolean) => void]>;
    /** An entry as the table, compact and wall modes show it. */
    itemView: (entry: T) => LibraryItemView;
    /** The table and compact modes' columns. */
    columns: LibraryColumn<T>[];
    /** Renders a capped catalogue-search preview for the current query, when a
     * library search comes up empty (no filters). Receives the trimmed query
     * and a callback to report back how many catalogue results it found. */
    catalogPreview?: Snippet<[string, (count: number) => void]>;
    /** Rendered beside the title, e.g. books' reading-goal chip. */
    headerActions?: Snippet;
    /** The selection mode's actions (UX-04); without them there's no selection mode. */
    bulk?: LibraryBulkActions;
    /** Saves an entry's favorite flag; the list shows it at once. */
    setFavorite: (entry: T, next: boolean) => Promise<unknown>;
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
  let activeViewId = $state(initialParams.get("view"));

  let sentinel = $state<HTMLElement | null>(null);

  // Extra "type" filter, owned by the page and passed to LibraryBrowser.
  let types = $state<MediaType[]>(
    (initialParams.get("type")?.split(",").filter(Boolean) as MediaType[]) ??
      [],
  );

  const reduced = prefersReducedMotion();

  let mode = $state<LibraryViewMode>(readLibraryViewMode(domain));

  function setMode(next: LibraryViewMode) {
    mode = next;
    writeLibraryViewMode(domain, next);
  }

  function sortBy(value: string) {
    if (sort === value) reversed = !reversed;
    else sort = value;
  }

  const current = $derived<SavedViewFiltersDto>({
    q: queryFilter,
    statuses,
    favorite: favoritesOnly,
    types,
    sort,
    order: reversed ? "asc" : "desc",
  });

  function applyFilters(filters: SavedViewFiltersDto) {
    query = queryFilter = filters.q ?? "";
    statuses = filters.statuses ?? [];
    favoritesOnly = filters.favorite ?? false;
    types = filters.types ?? [];
    // A sort this library no longer offers falls back to its default.
    sort = sorts.some((o) => o.value === filters.sort)
      ? filters.sort!
      : defaultSort;
    reversed = filters.order === "asc";
    previewCount = null;
  }

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
  //
  // `page.url.pathname` is read via `untrack` deliberately: this function
  // runs inside the `$effect` below, and Svelte tracks every reactive read
  // that happens during an effect's synchronous execution — including ones
  // buried in a called function, not just ones written directly in the
  // effect body. Reading it untracked keeps the effect's dependencies to
  // exactly the filters and the view in use; without this,
  // `goto()` (which updates `page.url`) makes the effect see its own output
  // as a fresh dependency change and re-fire itself, forever.
  function syncUrl() {
    const params = filtersToSearchParams(current, defaultSort);
    if (activeViewId) params.set("view", activeViewId);
    const qs = params.toString();
    void goto(qs ? `?${qs}` : untrack(() => page.url.pathname), {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }

  $effect(() => {
    // Tracked: the filters in `current`, and the view in use.
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

  const pileParams = $derived<PileLoadParams>({
    query: queryFilter,
    statuses,
    favoritesOnly,
    extra: types,
  });
  const pileQuery = createApiQuery(() => ({
    key: keys.library.pile(domain, pileParams),
    fetch: () => loadPile!(pileParams),
    enabled: !!loadPile,
    keepPreviousData: true,
  }));

  const items = $derived(browseQuery.data);
  const error = $derived(browseQuery.error);
  const total = $derived(browseQuery.pages.at(-1)?.total ?? 0);
  const loading = $derived(browseQuery.loading);
  const loadingMore = $derived(browseQuery.isFetchingNextPage);
  const headerSubtitle = $derived(
    [subtitle(total), pileQuery.data && pileHeaderLabel(domain, pileQuery.data)]
      .filter(Boolean)
      .join(" · "),
  );

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

  // ── Selection mode (UX-04)
  const UNDO_DELAY_MS = 6000;
  const LONG_PRESS_MS = 450;
  const queryClient = useQueryClient();

  let selecting = $state(false);
  const selected = new SvelteSet<string>();
  // Every entry the filters match, loaded or not: sent as the filters
  // themselves, since the pages past the loaded ones have no ids here yet.
  let allMatching = $state(false);
  let anchor: string | null = null;
  let confirmingRemove = $state(false);
  // Removed entries stay hidden, not deleted, while their undo toast shows.
  const hidden = new SvelteSet<string>();
  let hideAll = $state(false);
  let pendingRemoval: {
    timer: ReturnType<typeof setTimeout>;
    commit: () => Promise<void>;
  } | null = null;

  const shown = $derived(
    hideAll ? [] : items.filter((entry) => !hidden.has(keyOf(entry))),
  );
  const selectedCount = $derived(allMatching ? total : selected.size);
  const allLoaded = $derived(
    shown.length > 0 && shown.every((entry) => selected.has(keyOf(entry))),
  );

  function toggle(entry: T, range: boolean) {
    const key = keyOf(entry);
    if (allMatching) {
      allMatching = false;
      for (const e of shown) selected.add(keyOf(e));
    }
    const order = shown.map(keyOf);
    const from = anchor ? order.indexOf(anchor) : -1;
    const to = order.indexOf(key);
    if (range && from >= 0 && to >= 0) {
      for (const k of order.slice(Math.min(from, to), Math.max(from, to) + 1))
        selected.add(k);
    } else if (selected.has(key)) {
      selected.delete(key);
    } else {
      selected.add(key);
    }
    anchor = key;
  }

  function selectLoaded() {
    allMatching = false;
    for (const entry of shown) selected.add(keyOf(entry));
  }

  function clearSelection() {
    selected.clear();
    allMatching = false;
    anchor = null;
  }

  function exitSelecting() {
    selecting = false;
    clearSelection();
  }

  const selection: LibrarySelection<T> = {
    get active() {
      return selecting;
    },
    has: (entry) => allMatching || selected.has(keyOf(entry)),
    toggle,
    get allLoaded() {
      return allMatching || allLoaded;
    },
    get someLoaded() {
      return !allLoaded && shown.some((entry) => selected.has(keyOf(entry)));
    },
    toggleLoaded: () =>
      allMatching || allLoaded ? clearSelection() : selectLoaded(),
  };

  // Other filters show other entries: a selection made under the previous
  // ones would act on rows no longer in sight.
  $effect(() => {
    void browseKey;
    untrack(clearSelection);
  });

  function bulkTarget(): BulkEntriesTargetDto {
    return allMatching ? { filters: current } : { ids: [...selected] };
  }

  function resultMessage(result: BulkEntriesResultDto): string {
    const done =
      result.updated === 1
        ? m.library_bulk_done_one({ count: result.updated })
        : m.library_bulk_done_many({ count: result.updated });
    return result.skipped > 0
      ? `${done} · ${m.library_bulk_skipped({ count: result.skipped })}`
      : done;
  }

  // The list's pages come from the query cache, not a deep $state: flipping
  // `entry.favorite` in place wouldn't re-render. Patch the cached pages
  // instead, and put the flag back if the save fails.
  function patchFavorite(key: string, favorite: boolean) {
    queryClient.setQueriesData<InfiniteData<PagedResult<T>>>(
      { queryKey: ["library", "browse", domain] },
      (data) =>
        data?.pages
          ? {
              ...data,
              pages: data.pages.map((p) => ({
                ...p,
                items: p.items.map((e) =>
                  keyOf(e) === key ? { ...e, favorite } : e,
                ),
              })),
            }
          : data,
    );
  }

  async function toggleFavorite(entry: T, next: boolean) {
    const key = keyOf(entry);
    patchFavorite(key, next);
    try {
      await setFavorite(entry, next);
    } catch (err) {
      patchFavorite(key, !next);
      toast.error(resolveApiError(err));
    }
  }

  // ── Table columns and in-place editing
  const wide = new MediaQuery("min-width: 768px");
  const defaultColumns = $derived(
    columns.filter((c) => !c.defaultHidden).map((c) => c.key),
  );
  let visibleColumns = $state<string[] | null>(readLibraryColumns(domain));
  const shownColumns = $derived(
    columns.filter(
      (c) =>
        c.kind === "title" ||
        (visibleColumns ?? defaultColumns).includes(c.key),
    ),
  );
  // Only where the table is a table: phones get rows with no columns.
  const columnMenu = $derived(
    wide.current && (mode === "table" || mode === "compact")
      ? columns.map((c) => ({
          key: c.key,
          label: c.label,
          visible: shownColumns.includes(c),
          locked: c.kind === "title",
        }))
      : undefined,
  );

  function toggleColumn(key: string) {
    const current = visibleColumns ?? defaultColumns;
    visibleColumns = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    writeLibraryColumns(domain, visibleColumns);
  }

  function resetColumns() {
    visibleColumns = null;
    writeLibraryColumns(domain, null);
  }

  let reviewing = $state<T | null>(null);
  let savedCell = $state<LibraryInlineEdit<T>["saved"]>(null);
  let savedTimer: ReturnType<typeof setTimeout> | undefined;

  // A single row goes through the bulk endpoint too, so completing a series
  // in place marks its episodes exactly as the selection bar would.
  const inlineMut = createApiMutation(() => ({
    mutate: ({
      entry,
      action,
    }: {
      entry: T;
      action: {
        status?: string;
        ownershipStatus?: string;
        ownershipSource?: string | null;
      };
    }) => bulk!.update({ ids: [keyOf(entry)], ...action }),
    invalidates: [["library"]],
    errorToast: true,
    onSuccess: (_result, { entry, action }) => {
      clearTimeout(savedTimer);
      savedCell = {
        key: keyOf(entry),
        field: action.status !== undefined ? "status" : "ownership",
      };
      savedTimer = setTimeout(() => (savedCell = null), 1600);
    },
  }));

  const inlineEdit: LibraryInlineEdit<T> | undefined = bulk && {
    statusOptions: bulk.statusOptions,
    ownershipOptions: bulk.ownershipOptions,
    ownershipSources: bulk.ownershipSources,
    save: (entry, action) => inlineMut.mutate({ entry, action }),
    get saved() {
      return savedCell;
    },
    review: (entry) => (reviewing = entry),
  };

  const bulkMut = createApiMutation(() => ({
    mutate: (dto: BulkUpdateEntriesDto) => bulk!.update(dto),
    invalidates: [["library"]],
    successToast: resultMessage,
    errorToast: true,
  }));

  function removeSelection() {
    confirmingRemove = false;
    const target = bulkTarget();
    const count = selectedCount;
    if (allMatching) hideAll = true;
    else for (const key of selected) hidden.add(key);
    exitSelecting();

    const restore = () => {
      hidden.clear();
      hideAll = false;
    };
    // The toast can outlive the delay (held open while hovered): once the
    // removal goes through, its "Cancel" would only fake an undo.
    let undoToast = -1;
    const commit = async () => {
      pendingRemoval = null;
      toast.dismiss(undoToast);
      try {
        await bulk!.remove(target);
        await queryClient.invalidateQueries({ queryKey: ["library"] });
      } catch (err) {
        toast.error(resolveApiError(err));
      } finally {
        restore();
      }
    };
    pendingRemoval = { timer: setTimeout(commit, UNDO_DELAY_MS), commit };
    undoToast = toast.show(
      count === 1
        ? m.library_bulk_removed_one({ count })
        : m.library_bulk_removed_many({ count }),
      "info",
      UNDO_DELAY_MS,
      [
        {
          label: m.common_cancel(),
          onSelect: () => {
            if (pendingRemoval) clearTimeout(pendingRemoval.timer);
            pendingRemoval = null;
            restore();
          },
        },
      ],
    );
  }

  // Leaving the page before the undo delay runs out confirms the removal.
  onDestroy(() => {
    if (!pendingRemoval) return;
    clearTimeout(pendingRemoval.timer);
    void pendingRemoval.commit();
  });

  let container = $state<HTMLElement | null>(null);

  function entryOf(element: Element | null): T | undefined {
    const key = element?.closest<HTMLElement>("[data-library-item]")?.dataset
      .libraryItem;
    return key === undefined ? undefined : shown.find((e) => keyOf(e) === key);
  }

  function focusItem(element: HTMLElement | undefined) {
    if (!element) return;
    const target = element.matches("a, button, input, [tabindex]")
      ? element
      : element.querySelector<HTMLElement>("input, a, button");
    // Keyboard-driven, so the focus ring must show even where the browser
    // would not infer it from a script call.
    target?.focus({ focusVisible: true } as FocusOptions);
    element.scrollIntoView({ block: "nearest" });
  }

  // J/K move to the next/previous entry, as do the arrows along the mode's
  // own axis (left/right in a grid, up/down in a list) once an entry has
  // focus. X toggles the focused one, Shift+A selects every loaded one,
  // Escape leaves selection mode.
  function onKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "input:not([type=checkbox]), textarea, select, [role=dialog]",
      )
    )
      return;

    if (e.key === "Escape" && selecting) {
      exitSelecting();
      return;
    }

    const elements = [
      ...(container?.querySelectorAll<HTMLElement>("[data-library-item]") ??
        []),
    ];
    const index = elements.indexOf(
      target.closest<HTMLElement>("[data-library-item]")!,
    );
    const key = e.key.toLowerCase();
    const grid = mode === "cards" || mode === "wall";
    const [next, previous] = grid
      ? ["ArrowRight", "ArrowLeft"]
      : ["ArrowDown", "ArrowUp"];
    const isArrow = e.key === next || e.key === previous;
    const step =
      key === "j" || e.key === next
        ? 1
        : key === "k" || e.key === previous
          ? -1
          : 0;

    if (step !== 0 && (!isArrow || index >= 0)) {
      e.preventDefault();
      focusItem(
        elements[
          index < 0
            ? 0
            : Math.min(elements.length - 1, Math.max(0, index + step))
        ],
      );
    } else if (key === "x" && bulk) {
      const entry = entryOf(target);
      if (!entry) return;
      e.preventDefault();
      selecting = true;
      toggle(entry, e.shiftKey);
    } else if (e.key === "A" && e.shiftKey && selecting) {
      e.preventDefault();
      selectLoaded();
    }
  }

  // Long press on touch: enters selection mode with the pressed entry.
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressOrigin = { x: 0, y: 0 };
  let swallowClick = false;

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === "mouse" || !bulk) return;
    const entry = entryOf(e.target as Element);
    if (!entry) return;
    pressOrigin = { x: e.clientX, y: e.clientY };
    pressTimer = setTimeout(() => {
      pressTimer = null;
      selecting = true;
      if (!selection.has(entry)) toggle(entry, false);
      swallowClick = true;
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  }

  function onPointerMove(e: PointerEvent) {
    if (
      pressTimer &&
      Math.hypot(e.clientX - pressOrigin.x, e.clientY - pressOrigin.y) > 8
    )
      cancelPress();
  }

  // The click that ends a long press must not also open the entry.
  function onClickCapture(e: MouseEvent) {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }

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
    subtitle={headerSubtitle}
    actions={headerActions}
    class="mb-6" />

  <SavedViewBar
    {domain}
    {current}
    {defaultSort}
    bind:activeId={activeViewId}
    onApply={applyFilters} />

  <div class="relative mb-4">
    <span
      class="text-dim pointer-events-none absolute inset-y-0 left-3 flex items-center">
      <Icon name="search" class="h-5 w-5" />
    </span>
    <input
      type="search"
      name="query"
      aria-label={m.library_filter_placeholder()}
      enterkeyhint="search"
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
        class="{favoritesOnly
          ? 'border-accent text-accent'
          : 'border-border text-dim hover:text-fg'} inline-flex items-center gap-0.5 rounded-lg border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors"
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
      <LibraryViewMenu
        {mode}
        onChange={setMode}
        selecting={bulk ? selecting : undefined}
        onToggleSelecting={() =>
          selecting ? exitSelecting() : (selecting = true)}
        columns={columnMenu}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns} />
    </div>
  </div>

  {#if selecting}
    <div
      transition:slide={{ duration: reduced ? 0 : 180 }}
      class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm {allMatching ||
      (allLoaded && total > shown.length)
        ? 'bg-accent/10 justify-center rounded-xl px-4 py-2.5'
        : 'text-dim'}">
      {#if allMatching}
        <span>{m.library_selected_matching({ count: total })}</span>
        <button type="button" class="link-accent" onclick={clearSelection}>
          {m.library_clear_selection()}
        </button>
      {:else if allLoaded && total > shown.length}
        <span>{m.library_selected_loaded({ count: shown.length })}</span>
        <button
          type="button"
          class="link-accent"
          onclick={() => (allMatching = true)}>
          {m.library_select_matching({ count: total })}
        </button>
      {:else}
        <span>{m.library_select_hint()}</span>
        {#if allLoaded}
          <button type="button" class="link-accent" onclick={clearSelection}>
            {m.library_clear_selection()}
          </button>
        {:else}
          <button type="button" class="link-accent" onclick={selectLoaded}>
            {m.common_select_all()}
          </button>
        {/if}
        <button type="button" class="link-accent" onclick={exitSelecting}>
          {m.common_cancel()}
        </button>
      {/if}
    </div>
  {/if}

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if showSkeleton}
    {@render skeleton(10)}
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
    {#key mode}
      <!-- Long press is a touch shortcut for entering selection mode; the
           keyboard has X and the "Affichage" menu. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={container}
        class="[-webkit-touch-callout:none]"
        in:fly={{ y: 8, duration: reduced ? 0 : 220 }}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={cancelPress}
        onpointercancel={cancelPress}
        onclickcapture={onClickCapture}>
        {#if mode === "cards"}
          <PosterGrid>
            {#each shown as entry (keyOf(entry))}
              {@const on = selection.has(entry)}
              <div
                class="has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-bg relative rounded-xl transition-shadow has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2"
                data-library-item={keyOf(entry)}
                animate:flip={{ duration: reduced ? 0 : 250 }}
                in:fade|global={{ duration: reduced ? 0 : 150 }}
                out:fade={{ duration: reduced ? 0 : 100 }}>
                {@render card(entry, (next) => toggleFavorite(entry, next))}
                {#if selecting}
                  <button
                    type="button"
                    class="absolute inset-0 z-20 rounded-xl transition-[background-color,box-shadow] duration-150 active:bg-black/10 {on
                      ? 'bg-accent/10 ring-accent ring-2'
                      : ''}"
                    aria-pressed={on}
                    aria-label={itemView(entry).title}
                    in:fade={{ duration: reduced ? 0 : 120 }}
                    onclick={(e) => toggle(entry, e.shiftKey)}>
                    <span
                      class="absolute top-2 left-2 grid h-6 w-6 place-items-center rounded-lg border-2 transition-colors {on
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-white bg-black/40'}">
                      {#if on}
                        <span
                          in:scale={{
                            duration: reduced ? 0 : 160,
                            start: 0.4,
                          }}>
                          <Icon name="check" class="h-3.5 w-3.5" />
                        </span>
                      {/if}
                    </span>
                  </button>
                {/if}
              </div>
            {/each}
          </PosterGrid>
        {:else if mode === "wall"}
          <LibraryWall items={shown} {keyOf} {itemView} {selection} />
        {:else}
          <LibraryTable
            items={shown}
            {keyOf}
            {itemView}
            columns={shownColumns}
            {sort}
            {reversed}
            onSort={sortBy}
            {selection}
            edit={inlineEdit}
            onToggleFavorite={toggleFavorite}
            compact={mode === "compact"} />
        {/if}
      </div>
    {/key}
    {#if browseQuery.hasNextPage}
      <!-- Sentinel: entering the viewport triggers the next page. -->
      <div bind:this={sentinel} class="absolute h-10"></div>
    {/if}
    {#if loadingMore}
      <div class="mt-4">
        {@render skeleton(5)}
      </div>
    {/if}
  {/if}
</div>

<svelte:window onkeydown={onKeydown} />

{#if bulk && selecting && selectedCount > 0}
  <LibraryBulkBar
    count={selectedCount}
    {bulk}
    busy={bulkMut.loading}
    onUpdate={(action) => bulkMut.mutate({ ...bulkTarget(), ...action })}
    onRemove={() => (confirmingRemove = true)}
    onExit={exitSelecting} />
{/if}

{#if reviewing}
  <LibraryReviewEditor
    item={itemView(reviewing)}
    onClose={() => (reviewing = null)} />
{/if}

{#if confirmingRemove}
  <ConfirmationModal
    title={selectedCount === 1
      ? m.library_bulk_remove_title_one({ count: selectedCount })
      : m.library_bulk_remove_title_many({ count: selectedCount })}
    message={m.library_bulk_remove_message()}
    confirmLabel={m.common_remove()}
    danger
    onConfirm={removeSelection}
    onCancel={() => (confirmingRemove = false)} />
{/if}

{#snippet skeleton(count: number)}
  {#if mode === "cards"}
    <PosterGridSkeleton {count} />
  {:else}
    <div role="status" aria-busy="true">
      <span class="sr-only">{m.common_loading()}</span>
      {#if mode === "wall"}
        <div
          aria-hidden="true"
          class="grid grid-cols-4 gap-1.5 sm:grid-cols-6 sm:gap-2 lg:grid-cols-8">
          {#each { length: count * 2 } as _, i (i)}
            <div class="skeleton aspect-2/3 rounded-lg"></div>
          {/each}
        </div>
      {:else}
        <div
          aria-hidden="true"
          class="border-border divide-border divide-y overflow-hidden rounded-xl border">
          {#each { length: count } as _, i (i)}
            <div class="flex items-center gap-3 px-3 py-2.5">
              {#if mode === "table"}
                <div class="skeleton h-12 w-8 rounded"></div>
              {/if}
              <div class="flex flex-1 flex-col gap-2">
                <div class="skeleton h-3.5 w-2/5 rounded"></div>
                <div class="skeleton h-3 w-1/4 rounded"></div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{/snippet}
