<script lang="ts">
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import ProfileSectionHeading from "#lib/components/profile/ProfileSectionHeading.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { isDomainEnabled, orderedDomains } from "#lib/domains.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { Domain, ProfileDomainStatDto } from "@loomkeep/shared";

  let {
    domains,
    selfManage,
  }: {
    domains: ProfileDomainStatDto[];
    selfManage: boolean | undefined;
  } = $props();

  const DOMAIN_HREF: Partial<Record<Domain, string>> = {
    MEDIA: "/app/media",
    GAMES: "/app/games",
    BOOKS: "/app/books",
    MUSIC: "/app/music",
  };

  // The viewer's own domains, in their own order — whoever's profile this
  // is: a domain they turned off stays out of here as out of the rest of the
  // app. A "coming soon" one they opted into shows as such: the server has
  // no library behind it to count.
  type Row = { domain: Domain; stat: ProfileDomainStatDto | null };
  const rows = $derived<Row[]>(
    orderedDomains(auth.user?.domainOrder)
      .filter(isDomainEnabled)
      .map((domain) => ({
        domain,
        stat: domains.find((d) => d.domain === domain) ?? null,
      })),
  );

  const visibleTotal = $derived(
    rows.reduce((sum, r) => sum + (r.stat?.visible ? r.stat.count : 0), 0),
  );
  const favoritesTotal = $derived(
    rows.reduce((sum, r) => sum + (r.stat?.visible ? r.stat.favorites : 0), 0),
  );
</script>

<section>
  <ProfileSectionHeading label={m.common_library()} />

  {#if visibleTotal > 0}
    <div class="flex h-2 gap-0.75" role="img" aria-label={m.common_library()}>
      {#each rows as { domain, stat } (domain)}
        {#if stat?.visible && stat.count > 0}
          <span
            class="rounded-[3px] transition-[filter] hover:brightness-110"
            style="background: {DOMAINS[domain].accent}; flex: {stat.count}"
          ></span>
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
    {#each rows as { domain, stat } (domain)}
      {@const href = selfManage && stat ? DOMAIN_HREF[domain] : undefined}
      {@const color = DOMAINS[domain].accent}
      <svelte:element
        this={href ? "a" : "div"}
        {href}
        class="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 {href
          ? 'hover:bg-surface-2 transition-colors'
          : ''}">
        <span
          class="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-lg transition-transform group-hover:scale-110"
          style="background: color-mix(in srgb, {color} 16%, transparent); color: {color};">
          <Icon name={DOMAINS[domain].icon} class="h-3.5 w-3.5" />
        </span>
        <p class="w-24 shrink-0 truncate text-sm font-semibold sm:w-36">
          {DOMAINS[domain].label}
        </p>
        {#if !stat}
          <span
            class="bg-surface-2 text-dim ml-auto rounded-full px-2 py-0.5 text-[0.6rem] font-bold whitespace-nowrap">
            {m.common_coming_soon()}
          </span>
        {:else if stat.visible}
          <span
            class="bg-surface-2 hidden h-1.5 flex-1 overflow-hidden rounded-full sm:block">
            <span
              class="block h-full rounded-full"
              style="width: {visibleTotal > 0
                ? (stat.count / visibleTotal) * 100
                : 0}%; background: {color}"></span>
          </span>
          <span class="ml-auto flex items-baseline gap-3">
            {#if stat.favorites > 0}
              <span
                class="text-accent font-mono text-xs font-bold whitespace-nowrap">
                ♥ {stat.favorites}
              </span>
            {/if}
            <span class="whitespace-nowrap">
              <span class="font-display text-lg font-extrabold tabular-nums"
                >{stat.count}</span>
              <span class="text-dim ml-0.5 text-[11px]"
                >{stat.count > 1
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
