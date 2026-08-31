<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import BookSearchPanel from "$lib/components/search/BookSearchPanel.svelte";
  import GameSearchPanel from "$lib/components/search/GameSearchPanel.svelte";
  import MediaSearchPanel from "$lib/components/search/MediaSearchPanel.svelte";
  import MusicSearchPanel from "$lib/components/search/MusicSearchPanel.svelte";
  import ScanIsbnModal from "$lib/components/ScanIsbnModal.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { debounce } from "$lib/debounce";
  import { isDomainEnabled } from "$lib/domains";
  import { m } from "$lib/paraglide/messages";
  import { Domain, type MediaType } from "@loomkeep/shared";

  const DOMAIN_HINT: Record<Domain, string> = {
    [Domain.MEDIA]: m.search_domain_media(),
    [Domain.GAMES]: m.search_domain_games(),
    [Domain.BOOKS]: m.search_domain_books(),
    [Domain.MUSIC]: m.search_domain_music(),
    [Domain.PODCASTS]: m.search_domain_podcasts(),
    [Domain.BOARDGAMES]: m.search_domain_boardgames(),
  };

  // Reuses the same one-hue-per-domain tokens as the stats charts
  // (`--stat-media/games/books/music` in app.css) rather than inventing a
  // second palette — "Bientôt" domains fall back to the neutral `--dim`.
  const DOMAIN_ACCENT_VAR: Record<Domain, string> = {
    [Domain.MEDIA]: "var(--stat-media)",
    [Domain.GAMES]: "var(--stat-games)",
    [Domain.BOOKS]: "var(--stat-books)",
    [Domain.MUSIC]: "var(--stat-music)",
    [Domain.PODCASTS]: "var(--dim)",
    [Domain.BOARDGAMES]: "var(--dim)",
  };

  // Only the domains the user keeps enabled are searchable (mirrors the nav;
  // the API enforces the same gate on the search endpoints).
  const enabledTabs = $derived(
    Object.entries(DOMAINS).filter(([d, _]) => isDomainEnabled(d as Domain)),
  );

  // `type` preselects the domain tab (e.g. linked from a library page's
  // "Chercher un jeu" / empty-search-preview "Voir plus"), same idea as
  // `query` prefilling the search box.
  const typeParam = page.url.searchParams.get("type");
  const initialDomain =
    typeParam && Object.keys(DOMAINS).some((t) => t === typeParam)
      ? (typeParam as Domain)
      : Domain.MEDIA;

  let query = $state(page.url.searchParams.get("query") ?? "");
  let domain = $state<Domain>(initialDomain);

  const placeholder = $derived(
    m.search_placeholder({ domain: DOMAIN_HINT[domain] }),
  );

  // Planned domains show a "coming soon" placeholder instead of a search panel.
  const comingSoon = $derived(DOMAINS[domain]?.comingSoon ?? false);

  // If the active domain gets disabled (or was never enabled), fall back to the
  // first enabled one so the panel below always matches a visible tab.
  $effect(() => {
    if (!isDomainEnabled(domain) && enabledTabs.length > 0) {
      domain = enabledTabs[0][0] as Domain;
    }
  });

  // Mirror query + domain into the URL (via `goto`, replacing the current
  // history entry — see LibraryBrowser's `syncUrl` for why `replaceState`
  // from $app/navigation doesn't work for this) so navigating back here from
  // a result's detail page restores this search instead of resetting it.
  const debouncedSyncUrl = debounce(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (domain !== Domain.MEDIA) params.set("type", domain);
    const qs = params.toString();
    void goto(qs ? `?${qs}` : page.url.pathname, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }, 300);
  $effect(() => {
    void query;
    void domain;
    debouncedSyncUrl.call();
  });

  // Tab cycles the domain instead of leaving the field — the tabs above the
  // bar are the fast path at a glance, this is the fast path without leaving
  // the keyboard. Escape blurs back out to normal Tab navigation.
  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      (event.currentTarget as HTMLInputElement).blur();
      return;
    }
    if (event.key === "Tab" && enabledTabs.length > 1) {
      event.preventDefault();
      const ids = enabledTabs.map(([d]) => d as Domain);
      const i = ids.indexOf(domain);
      domain = ids[(i + (event.shiftKey ? -1 : 1) + ids.length) % ids.length];
    }
  }

  // The sous-filtre lives inside the bar itself (right edge), not below it —
  // Musique has no search-by criteria of its own yet.
  const MEDIA_TYPE_OPTIONS: { label: string; value: MediaType | undefined }[] =
    [
      { label: "Tout", value: undefined },
      { label: "Films", value: "MOVIE" },
      { label: "Séries", value: "SERIES" },
      { label: "Animés", value: "ANIME" },
    ];
  type BookMode = "title" | "author" | "isbn";
  const BOOK_MODE_OPTIONS: { label: string; value: BookMode }[] = [
    { label: "Titre", value: "title" },
    { label: "Auteur", value: "author" },
    { label: "ISBN", value: "isbn" },
  ];
  type GameMode = "title" | "studio" | "franchise";
  const GAME_MODE_OPTIONS: { label: string; value: GameMode }[] = [
    { label: "Titre", value: "title" },
    { label: "Studio", value: "studio" },
    { label: "Franchise", value: "franchise" },
  ];

  let mediaType = $state<MediaType | undefined>(undefined);
  let bookMode = $state<BookMode>("title");
  let gameMode = $state<GameMode>("title");
  let filterOpen = $state(false);
  let filterBtnEl = $state<HTMLButtonElement | null>(null);
  let filterMenuEl = $state<HTMLDivElement | null>(null);

  const hasFilter = $derived(
    domain === Domain.MEDIA ||
      domain === Domain.BOOKS ||
      domain === Domain.GAMES,
  );
  const filterLabel = $derived(
    domain === Domain.MEDIA
      ? (MEDIA_TYPE_OPTIONS.find((o) => o.value === mediaType)?.label ?? "Tout")
      : domain === Domain.BOOKS
        ? (BOOK_MODE_OPTIONS.find((o) => o.value === bookMode)?.label ??
          "Titre")
        : (GAME_MODE_OPTIONS.find((o) => o.value === gameMode)?.label ??
          "Titre"),
  );

  function closeFilter() {
    filterOpen = false;
  }

  // The filter menu is domain-specific — a stale open menu from the previous
  // domain would show the wrong options for a frame.
  $effect(() => {
    void domain;
    filterOpen = false;
  });

  $effect(() => {
    if (!filterOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (filterMenuEl?.contains(target) || filterBtnEl?.contains(target)) {
        return;
      }
      closeFilter();
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") closeFilter();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeydown);
    };
  });

  // ISBN barcode scan (mobile only) — feature-detected since BarcodeDetector
  // is Chrome/Edge-only today; the trigger just doesn't render on browsers
  // without it rather than opening a scanner that can never decode anything.
  let scanOpen = $state(false);
  const barcodeSupported =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  function onIsbnScanned(isbn: string) {
    bookMode = "isbn";
    query = isbn;
  }
</script>

<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="search"
    title={m.common_search()}
    subtitle={m.search_subtitle()}
    class="mb-6" />

  <div
    class="guichet mb-5"
    style={`--domain-accent: ${DOMAIN_ACCENT_VAR[domain]}`}>
    {#if enabledTabs.length > 1}
      <div class="guichet-tabs no-scrollbar">
        {#each enabledTabs as tab (tab[0])}
          <button
            type="button"
            class="guichet-tab"
            class:guichet-tab-active={domain === tab[0]}
            onclick={() => (domain = tab[0] as Domain)}>
            <Icon name={tab[1].icon} class="h-3.5 w-3.5" />
            {tab[1].label}
            {#if tab[1].comingSoon}
              <span class="guichet-tab-soon">{m.landing_libraries_soon()}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <div class="guichet-bar" class:guichet-bar-solo={enabledTabs.length <= 1}>
      <Icon name="search" class="text-dim h-5 w-5 shrink-0" />
      <div class="guichet-input-wrap">
        <input
          type="search"
          {placeholder}
          bind:value={query}
          onkeydown={handleSearchKeydown}
          class="guichet-input" />

        {#if enabledTabs.length > 1}
          <!-- Overlaid, not a flex sibling — as a real layout child it would
               steal width (and thus click area) from the input even while
               invisible, leaving a dead zone that doesn't focus it. -->
          <span class="guichet-hint hidden items-center gap-1 md:flex">
            <kbd>Tab</kbd>
            {m.search_domain_switch_hint()}
          </span>
        {/if}
      </div>

      {#if hasFilter}
        <div class="guichet-filter">
          <button
            type="button"
            bind:this={filterBtnEl}
            class="guichet-filter-btn"
            aria-expanded={filterOpen}
            onclick={() => (filterOpen = !filterOpen)}>
            {filterLabel}
            <Icon name="chevron-down" class="h-3 w-3" />
          </button>
          {#if filterOpen}
            <div bind:this={filterMenuEl} class="guichet-filter-menu shadow-xl">
              {#if domain === Domain.MEDIA}
                {#each MEDIA_TYPE_OPTIONS as opt (opt.label)}
                  <button
                    type="button"
                    class="guichet-filter-option"
                    class:guichet-filter-option-active={mediaType === opt.value}
                    onclick={() => {
                      mediaType = opt.value;
                      closeFilter();
                    }}>
                    {opt.label}
                  </button>
                {/each}
              {:else if domain === Domain.BOOKS}
                {#each BOOK_MODE_OPTIONS as opt (opt.label)}
                  <button
                    type="button"
                    class="guichet-filter-option"
                    class:guichet-filter-option-active={bookMode === opt.value}
                    onclick={() => {
                      bookMode = opt.value;
                      closeFilter();
                    }}>
                    {opt.label}
                  </button>
                {/each}
              {:else if domain === Domain.GAMES}
                {#each GAME_MODE_OPTIONS as opt (opt.label)}
                  <button
                    type="button"
                    class="guichet-filter-option"
                    class:guichet-filter-option-active={gameMode === opt.value}
                    onclick={() => {
                      gameMode = opt.value;
                      closeFilter();
                    }}>
                    {opt.label}
                  </button>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      {#if domain === Domain.BOOKS && barcodeSupported}
        <button
          type="button"
          class="guichet-scan-btn md:hidden"
          aria-label={m.scan_isbn_title()}
          onclick={() => (scanOpen = true)}>
          <Icon name="camera" class="h-4 w-4" />
        </button>
      {/if}
    </div>
  </div>

  {#if comingSoon}
    <div
      class="border-border text-dim flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
      <Icon
        name={domain === Domain.PODCASTS ? "podcast" : "boardgame"}
        class="text-dim/60 h-8 w-8" />
      <p class="text-fg font-semibold">{m.search_coming_soon()}</p>
      <p class="max-w-xs text-sm">
        {m.search_coming_soon_desc()}
      </p>
    </div>
  {:else if domain === Domain.MEDIA}
    <MediaSearchPanel {query} type={mediaType} />
  {:else if domain === Domain.GAMES}
    <GameSearchPanel {query} mode={gameMode} />
  {:else if domain === Domain.BOOKS}
    <BookSearchPanel {query} mode={bookMode} />
  {:else if domain === Domain.MUSIC}
    <MusicSearchPanel {query} />
  {/if}
</div>

{#if scanOpen}
  <ScanIsbnModal onclose={() => (scanOpen = false)} ondetect={onIsbnScanned} />
{/if}

<style>
  /* "Le Guichet" — domain tabs sit like ticket stubs above the bar; the
     active one lifts and hands its color down as the bar's top edge, so the
     two read as one connected control instead of a filter row plus a
     separate input. */
  .guichet-tabs {
    display: flex;
    gap: 0.25rem;
    /* Padding gives the active tab's -2px lift *and* the global focus ring
       (2px outline + 2px offset = 4px, 6px on top where the lift adds to
       it) room to sit in without being clipped by `overflow-x: auto`, which
       forces the y-axis to clip too (CSS overflow computes the other axis
       to `auto` once one axis isn't `visible`). */
    padding: 6px 5px 4px;
    margin: -6px -5px -4px;
    overflow-x: auto;
  }

  .guichet-tab {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    position: relative;
    white-space: nowrap;
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: 0.625rem 0.625rem 0 0;
    background: var(--surface-2);
    color: var(--dim);
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    transition:
      color 0.2s ease,
      transform 0.15s ease;
  }

  .guichet-tab-active {
    background: var(--surface);
    color: var(--domain-accent);
    transform: translateY(-2px);
    box-shadow: 0 -2px 0 var(--domain-accent) inset;
  }

  .guichet-tab-soon {
    font-family: var(--font-mono);
    font-size: 0.55rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: var(--border);
    color: var(--dim);
    border-radius: 999px;
    padding: 0.1rem 0.35rem;
  }

  .guichet-bar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    border: 1px solid var(--border);
    border-top: 2.5px solid var(--domain-accent);
    border-radius: 0 0.875rem 0.875rem 0.875rem;
    background: var(--surface);
    padding: 0 0.5rem 0 1rem;
    transition:
      border-color 0.2s ease,
      border-top-color 0.25s ease,
      box-shadow 0.2s ease;
  }

  /* Focus state — the bar itself picks up the domain's color, not just the
     top edge, so typing reads as clearly "in" the control. Keyed off the
     *input's* own focus specifically (`:has()`), not `:focus-within` — the
     filter button also lives inside the bar and has its own focus/hover
     affordance, it shouldn't also light up the whole bar as if typing. */
  .guichet-bar:has(.guichet-input:focus) {
    border-color: var(--domain-accent);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--domain-accent) 16%, transparent);
  }

  .guichet-bar-solo {
    border-radius: 0.875rem;
  }

  .guichet-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .guichet-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    padding: 0.85rem 0;
    font-size: 0.95rem;
    color: var(--fg);
  }

  .guichet-input::placeholder {
    color: var(--dim);
  }

  /* The sous-filtre (type/mode) — a pill button flush inside the bar's
     right edge, opening a small menu, rather than a separate row of chips. */
  .guichet-filter {
    position: relative;
    flex: none;
  }

  .guichet-filter-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--fg);
    padding: 0.4rem 0.65rem;
    font-size: 0.78rem;
    font-weight: 600;
    transition: border-color 0.2s ease;
  }

  .guichet-filter-btn:hover {
    border-color: var(--domain-accent);
  }

  .guichet-filter-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 20;
    display: grid;
    gap: 0.1rem;
    min-width: 9.5rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--surface);
    padding: 0.35rem;
  }

  .guichet-filter-option {
    text-align: left;
    border: none;
    border-radius: 0.5rem;
    background: none;
    color: var(--dim);
    padding: 0.45rem 0.6rem;
    font-size: 0.82rem;
    transition:
      color 0.15s ease,
      background-color 0.15s ease;
  }

  .guichet-filter-option:hover {
    background: var(--surface-2);
    color: var(--fg);
  }

  .guichet-filter-option-active {
    color: var(--domain-accent);
    font-weight: 600;
  }

  /* ISBN barcode scan trigger — mobile only, and only when the browser
     actually supports BarcodeDetector (see `barcodeSupported`). */
  .guichet-scan-btn {
    display: grid;
    place-items: center;
    flex: none;
    width: 2.1rem;
    height: 2.1rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--dim);
    transition:
      color 0.2s ease,
      border-color 0.2s ease;
  }

  .guichet-scan-btn:hover {
    color: var(--fg);
    border-color: var(--domain-accent);
  }

  /* Overlaid on the input's right edge, inside the bar, and only shown
     while the *input itself* has focus (not the filter button, which also
     sits inside the bar) — keyed off `.guichet-input:focus` via the
     adjacent-sibling combinator, no JS state needed. Absolutely positioned
     (not a flex sibling) so it never steals click area from the input
     underneath, even while invisible. */
  .guichet-hint {
    position: absolute;
    right: 0;
    top: 50%;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--dim);
    opacity: 0;
    transform: translate(-4px, -50%);
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
    pointer-events: none;
  }

  .guichet-input:focus + .guichet-hint {
    opacity: 1;
    transform: translate(0, -50%);
  }

  .guichet-hint kbd {
    font-family: inherit;
    border: 1px solid var(--border);
    border-bottom-width: 2px;
    border-radius: 4px;
    padding: 0.03rem 0.28rem;
    background: var(--surface-2);
  }

  @media (prefers-reduced-motion: reduce) {
    .guichet-tab-active {
      transform: none;
    }
    /* Keep the vertical centering (translateY), just drop the slide-in. */
    .guichet-hint,
    .guichet-input:focus + .guichet-hint {
      transform: translateY(-50%);
    }
  }
</style>
