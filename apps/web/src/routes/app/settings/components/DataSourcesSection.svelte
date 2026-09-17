<script lang="ts">
  import { page } from "$app/state";
  import ProviderMark from "$lib/components/ProviderMark.svelte";
  import {
    ANILIST_API,
    IGDB_API,
    MUSICBRAINZ_API,
    OMDB_API,
    OPENLIBRARY_API,
    TMDB_API,
  } from "$lib/constants/external-links";
  import { m } from "$lib/paraglide/messages.js";
  import type { ProviderBrandKey } from "$lib/provider-brands";
  import { flashAnchor } from "../flash-anchor";

  // TMDB's notice text is quoted verbatim by their API Terms of Use and kept
  // identical across locales for that reason — see messages/*.json.
  const PROVIDERS: {
    brand?: ProviderBrandKey;
    name: string;
    href: string;
    notice: string;
  }[] = [
    {
      brand: "tmdb",
      name: "TMDB",
      href: TMDB_API,
      notice: m.datasource_tmdb_notice(),
    },
    {
      brand: "anilist",
      name: "AniList",
      href: ANILIST_API,
      notice: m.settings_datasources_anilist_notice(),
    },
    {
      brand: "omdb",
      name: "OMDb",
      href: OMDB_API,
      notice: m.settings_datasources_omdb_notice(),
    },
    {
      brand: "igdb",
      name: "IGDB",
      href: IGDB_API,
      notice: m.settings_datasources_igdb_notice(),
    },
    {
      brand: "openlibrary",
      name: "Open Library",
      href: OPENLIBRARY_API,
      notice: m.settings_datasources_openlibrary_notice(),
    },
    {
      brand: "musicbrainz",
      name: "MusicBrainz",
      href: MUSICBRAINZ_API,
      notice: m.settings_datasources_musicbrainz_notice(),
    },
  ];
</script>

<ul class="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2">
  {#each PROVIDERS as p (p.name)}
    <li class="flex">
      <a
        id={`datasource-${p.name.toLowerCase().replaceAll(" ", "-")}`}
        use:flashAnchor={{
          anchor: `datasource-${p.name.toLowerCase().replaceAll(" ", "-")}`,
          hash: page.url.hash,
        }}
        href={p.href}
        target="_blank"
        rel="noopener noreferrer"
        class="card hover:border-accent hover:bg-surface-2 flex h-full w-full items-start gap-2.5 p-4 text-left text-sm transition-[border-color,background-color]">
        {#if p.brand}
          <ProviderMark brand={p.brand} class="mt-0.5 h-4 w-4 shrink-0" />
        {/if}
        <span class="min-w-0">
          <span class="font-semibold">{p.name}</span>
          <span class="text-dim mt-1 block text-xs font-normal">
            {p.notice}
          </span>
        </span>
      </a>
    </li>
  {/each}
</ul>
