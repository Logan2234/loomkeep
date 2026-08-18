<script lang="ts">
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import BookSearchPanel from "$lib/components/search/BookSearchPanel.svelte";
  import GameSearchPanel from "$lib/components/search/GameSearchPanel.svelte";
  import MediaSearchPanel from "$lib/components/search/MediaSearchPanel.svelte";
  import MusicSearchPanel from "$lib/components/search/MusicSearchPanel.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { debounce } from "$lib/debounce";
  import { isDomainEnabled } from "$lib/domains";
  import { Domain } from "@loomkeep/shared";

  // Search-box placeholder fragment, named after the active domain tab.
  const DOMAIN_HINT: Record<Domain, string> = {
    [Domain.MEDIA]: "un film, une série",
    [Domain.GAMES]: "un jeu",
    [Domain.BOOKS]: "un livre",
    [Domain.MUSIC]: "un album",
    [Domain.PODCASTS]: "un podcast",
    [Domain.BOARDGAMES]: "un jeu de société",
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

  const placeholder = $derived(`Chercher ${DOMAIN_HINT[domain]}…`);

  // Planned domains show a "coming soon" placeholder instead of a search panel.
  const comingSoon = $derived(DOMAINS[domain]?.comingSoon ?? false);

  // If the active domain gets disabled (or was never enabled), fall back to the
  // first enabled one so the panel below always matches a visible tab.
  $effect(() => {
    if (!isDomainEnabled(domain) && enabledTabs.length > 0) {
      domain = enabledTabs[0][0] as Domain;
    }
  });

  // Mirror query + domain into the URL (replaceState, no new history entry) so
  // navigating back here from a result's detail page restores this search
  // instead of resetting it.
  const debouncedSyncUrl = debounce(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (domain !== Domain.MEDIA) params.set("type", domain);
    const qs = params.toString();
    replaceState(qs ? `?${qs}` : page.url.pathname, {});
  }, 300);
  $effect(() => {
    void query;
    void domain;
    debouncedSyncUrl.call();
  });
</script>

<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="search"
    title="Recherche"
    subtitle="Trouve un titre et ajoute-le à ta bibliothèque."
    class="mb-6" />

  <div class="relative mb-5">
    <span
      class="text-dim pointer-events-none absolute inset-y-0 left-3 flex items-center">
      <Icon name="search" class="h-5 w-5" />
    </span>
    <input type="search" {placeholder} bind:value={query} class="input pl-10" />
  </div>

  {#if enabledTabs.length > 1}
    <div class="mb-5 flex flex-wrap gap-2">
      {#each enabledTabs as tab (tab[0])}
        <button
          class="chip"
          class:chip-on={domain === tab[0]}
          onclick={() => (domain = tab[0] as Domain)}>
          <Icon name={tab[1].icon} class="mr-1 -ml-0.5 inline h-3.5 w-3.5" />
          {tab[1].label}
          {#if tab[1].comingSoon}
            <span
              class="bg-surface-2 text-dim ml-1.5 rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold">
              Bientôt
            </span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if comingSoon}
    <div
      class="border-border text-dim flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
      <Icon
        name={domain === Domain.PODCASTS ? "podcast" : "boardgame"}
        class="text-dim/60 h-8 w-8" />
      <p class="text-fg font-semibold">Bientôt disponible</p>
      <p class="max-w-xs text-sm">
        La recherche de ce domaine arrive prochainement.
      </p>
    </div>
  {:else if domain === Domain.MEDIA}
    <MediaSearchPanel {query} />
  {:else if domain === Domain.GAMES}
    <GameSearchPanel {query} />
  {:else if domain === Domain.BOOKS}
    <BookSearchPanel {query} />
  {:else if domain === Domain.MUSIC}
    <MusicSearchPanel {query} />
  {/if}
</div>
