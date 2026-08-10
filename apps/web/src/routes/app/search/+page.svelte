<script lang="ts">
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import BookSearchPanel from "$lib/components/search/BookSearchPanel.svelte";
  import GameSearchPanel from "$lib/components/search/GameSearchPanel.svelte";
  import MediaSearchPanel from "$lib/components/search/MediaSearchPanel.svelte";
  import MusicSearchPanel from "$lib/components/search/MusicSearchPanel.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { Domain } from "@loomkeep/shared";

  type DomainIcon =
    "tv" | "gamepad" | "book" | "music" | "podcast" | "boardgame";

  const DOMAIN_TABS: {
    label: string;
    value: Domain;
    icon: DomainIcon;
    comingSoon?: boolean;
  }[] = [
    { label: "Vidéo", value: Domain.MEDIA, icon: "tv" },
    { label: "Jeux", value: Domain.GAMES, icon: "gamepad" },
    { label: "Livres", value: Domain.BOOKS, icon: "book" },
    { label: "Musique", value: Domain.MUSIC, icon: "music" },
    {
      label: "Podcasts",
      value: Domain.PODCASTS,
      icon: "podcast",
      comingSoon: true,
    },
    {
      label: "Jeux de société",
      value: Domain.BOARDGAMES,
      icon: "boardgame",
      comingSoon: true,
    },
  ];

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
    DOMAIN_TABS.filter((t) => isDomainEnabled(t.value)),
  );

  // `type` preselects the domain tab (e.g. linked from a library page's
  // "Chercher un jeu" / empty-search-preview "Voir plus"), same idea as
  // `query` prefilling the search box.
  const typeParam = page.url.searchParams.get("type");
  const initialDomain =
    typeParam && DOMAIN_TABS.some((t) => t.value === typeParam)
      ? (typeParam as Domain)
      : Domain.MEDIA;

  let query = $state(page.url.searchParams.get("query") ?? "");
  let domain = $state<Domain>(initialDomain);

  const placeholder = $derived(`Chercher ${DOMAIN_HINT[domain]}…`);

  // Planned domains show a "coming soon" placeholder instead of a search panel.
  const comingSoon = $derived(
    DOMAIN_TABS.find((t) => t.value === domain)?.comingSoon ?? false,
  );

  // If the active domain gets disabled (or was never enabled), fall back to the
  // first enabled one so the panel below always matches a visible tab.
  $effect(() => {
    if (!isDomainEnabled(domain) && enabledTabs.length > 0) {
      domain = enabledTabs[0].value;
    }
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
      {#each enabledTabs as tab (tab.value)}
        <button
          class="chip"
          class:chip-on={domain === tab.value}
          onclick={() => (domain = tab.value)}>
          <Icon name={tab.icon} class="mr-1 -ml-0.5 inline h-3.5 w-3.5" />
          {tab.label}
          {#if tab.comingSoon}
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
