<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import ProfileSectionHeading from "$lib/components/profile/ProfileSectionHeading.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { IconName } from "$lib/types/icon-name";
  import type { ProfileDomainStatDto } from "@loomkeep/shared";

  let {
    domains,
    selfManage,
  }: {
    domains: ProfileDomainStatDto[];
    selfManage: boolean | undefined;
  } = $props();

  const DOMAIN_LABEL: Record<string, string> = {
    MEDIA: m.common_Media(),
    GAMES: m.common_Games(),
    BOOKS: m.common_Books(),
    MUSIC: m.common_Music(),
    PODCASTS: m.common_Podcasts(),
    BOARDGAMES: m.common_Boardgames(),
  };

  const DOMAIN_HREF: Record<string, string> = {
    MEDIA: "/app/media",
    GAMES: "/app/games",
    BOOKS: "/app/books",
    MUSIC: "/app/music",
  };

  const DOMAIN_ICON: Record<string, IconName> = {
    MEDIA: "tv",
    GAMES: "gamepad",
    BOOKS: "book",
    MUSIC: "music",
    PODCASTS: "podcast",
    BOARDGAMES: "boardgame",
  };

  const DOMAIN_COLOR: Record<string, string> = {
    MEDIA: "var(--stat-media)",
    GAMES: "var(--stat-games)",
    BOOKS: "var(--stat-books)",
    MUSIC: "var(--stat-music)",
  };

  const visibleTotal = $derived(
    domains.reduce((sum, d) => sum + (d.visible ? d.count : 0), 0),
  );
  const favoritesTotal = $derived(
    domains.reduce((sum, d) => sum + (d.visible ? d.favorites : 0), 0),
  );
</script>

<section>
  <ProfileSectionHeading label={m.common_library()} />

  {#if visibleTotal > 0}
    <div class="flex h-3 gap-0.75" role="img" aria-label={m.common_library()}>
      {#each domains as d (d.domain)}
        {#if d.visible && d.count > 0}
          <span
            class="rounded-[3px] transition-[filter] hover:brightness-110"
            style="background: {DOMAIN_COLOR[d.domain] ??
              'var(--dim)'}; flex: {d.count}"></span>
        {/if}
      {/each}
    </div>
    <p class="text-dim mt-2 font-mono text-[11.5px]">
      {visibleTotal}
      {visibleTotal > 1 ? m.library_title_many() : m.library_title_one()}
      {#if favoritesTotal > 0}
        <span aria-hidden="true">·</span>
        {favoritesTotal}
        {favoritesTotal > 1
          ? m.profile_favorite_many()
          : m.profile_favorite_one()}
      {/if}
    </p>
  {/if}

  <div class="divide-border/70 mt-4 flex flex-col divide-y">
    {#each domains as d (d.domain)}
      {@const href = selfManage ? DOMAIN_HREF[d.domain] : undefined}
      {@const color = DOMAIN_COLOR[d.domain] ?? "var(--dim)"}
      <svelte:element
        this={href ? "a" : "div"}
        {href}
        class="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 {href
          ? 'hover:bg-surface-2 transition-colors'
          : ''}">
        <span
          class="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-lg"
          style="background: color-mix(in srgb, {color} 16%, transparent); color: {color};">
          <Icon name={DOMAIN_ICON[d.domain] ?? "library"} class="h-3.5 w-3.5" />
        </span>
        <p class="w-24 shrink-0 truncate text-sm font-semibold sm:w-36">
          {DOMAIN_LABEL[d.domain] ?? d.domain}
        </p>
        {#if d.visible}
          <span
            class="bg-surface-2 hidden h-1.5 flex-1 overflow-hidden rounded-full sm:block">
            <span
              class="block h-full rounded-full"
              style="width: {visibleTotal > 0
                ? (d.count / visibleTotal) * 100
                : 0}%; background: {color}"></span>
          </span>
          <span class="ml-auto flex items-baseline gap-3">
            {#if d.favorites > 0}
              <span
                class="text-accent font-mono text-xs font-bold whitespace-nowrap">
                ♥ {d.favorites}
              </span>
            {/if}
            <span class="whitespace-nowrap">
              <span class="font-display text-lg font-extrabold tabular-nums"
                >{d.count}</span>
              <span class="text-dim ml-0.5 text-[11px]"
                >{d.count > 1
                  ? m.library_title_many()
                  : m.library_title_one()}</span>
            </span>
          </span>
        {:else}
          <span
            class="text-dim ml-auto flex items-center gap-1.5 text-xs whitespace-nowrap">
            <Icon name="lock" class="h-3 w-3" />
            {m.common_private()}
          </span>
        {/if}
      </svelte:element>
    {/each}
  </div>
</section>
