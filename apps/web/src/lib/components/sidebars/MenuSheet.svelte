<script lang="ts">
  import { type IconName } from "#lib/types/icon-name.js";

  // The phone's menu: a sheet pulled up from the bottom bar (or opened from
  // its grabber) with what the bar, the Library fan and the edge tab don't
  // carry: the account card, then tracking and account rows. Inside /admin
  // it swaps to the admin sections as tiles (mirroring the rail) so admin
  // subpages stay reachable on a phone.

  import { page } from "$app/state";
  import { MENU_PULL_EVENT } from "#lib/actions/pull-menu.js";
  import { signOutAndRedirect } from "#lib/api/auth.js";
  import { getMyProgression } from "#lib/api/gamification.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Drawer from "#lib/components/Drawer.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { VISIBLE_ADMIN_NAV_GROUPS } from "#lib/constants/admin-nav.js";
  import { isDomainEnabled } from "#lib/domain-availability.js";
  import { isFeatureNew, type FeatureBadgeKey } from "#lib/feature-badges.js";
  import { mobileNav } from "#lib/mobile-nav.svelte.js";
  import { formatNumber } from "#lib/format.js";
  import { profileHref, resolveMenuGroups } from "#lib/navigation.js";
  import { navStyle } from "#lib/nav-style.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { useAdminUpdateAvailable } from "#lib/admin-update.svelte.js";
  import { useReportsPendingCount } from "#lib/reports-pending.svelte.js";
  import { levelProgress, xpForLevel } from "@loomkeep/shared";

  let open = $state(false);
  let pull = $state<number | null>(null);

  const inAdmin = $derived(page.url.pathname.startsWith("/app/admin"));
  const reportsPending = useReportsPendingCount();
  const adminUpdate = useAdminUpdateAvailable();

  const groups = $derived(
    resolveMenuGroups(
      {
        isDomainEnabled,
        isAdmin: auth.isAdmin,
        socialEnabled: appConfig.socialEnabled,
        gamificationEnabled: appConfig.gamificationEnabled,
      },
      // The board skin always carries Home and Search on its strip.
      navStyle.choice === "board" ? ["home", "search"] : mobileNav.shortcuts,
    ),
  );

  function close() {
    open = false;
  }

  async function signOut() {
    close();
    await signOutAndRedirect();
  }

  $effect(() => {
    const handler = () => (open = !open);
    const onPull = (event: Event) => {
      const distance = (event as CustomEvent<number | null>).detail;
      if (distance !== null) open = true;
      pull = distance;
    };
    window.addEventListener("mobile-menu-toggle", handler);
    window.addEventListener(MENU_PULL_EVENT, onPull);
    return () => {
      window.removeEventListener("mobile-menu-toggle", handler);
      window.removeEventListener(MENU_PULL_EVENT, onPull);
    };
  });

  // The same cache entry as the level widget and the profile page.
  const progressionQuery = createApiQuery(() => ({
    key: keys.gamification.progression(),
    fetch: getMyProgression,
    enabled: open && !!auth.user && appConfig.gamificationEnabled,
  }));
  const progress = $derived(
    progressionQuery.data ? levelProgress(progressionQuery.data.xp) : null,
  );
  const levelShare = $derived(
    progress
      ? progress.xpInLevel /
          (xpForLevel(progress.level + 1) - xpForLevel(progress.level))
      : 0,
  );
</script>

{#snippet tile(dest: {
  href: string;
  label: string;
  icon: IconName;
  match: (p: string) => boolean;
  newBadgeKey?: FeatureBadgeKey;
})}
  {@const active = dest.match(page.url.pathname)}
  <a
    href={dest.href}
    onclick={close}
    aria-current={active ? "page" : undefined}
    class="relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors {active
      ? 'border-accent/40 bg-accent/10 text-accent'
      : 'border-border bg-surface-2 hover:border-accent/40 text-fg'}">
    {#if dest.newBadgeKey && isFeatureNew(dest.newBadgeKey)}
      <span
        class="bg-accent ring-surface absolute top-2 right-2 h-2 w-2 rounded-full ring-2"
        aria-hidden="true"></span>
    {/if}
    <Icon name={dest.icon} class="text-accent h-6 w-6" />
    <span class="text-xs font-semibold">{dest.label}</span>
    {#if dest.href === "/app/admin/services" && adminUpdate.available}
      <span
        class="bg-accent ring-surface absolute top-2 right-2 h-2 w-2 rounded-full ring-2"
        aria-hidden="true"></span
      ><span class="sr-only">{m.admin_update_badge()}</span>
    {/if}
    {#if dest.href === "/app/admin/reports" && appConfig.socialEnabled && reportsPending.available && reportsPending.count > 0}
      <span
        class="bg-accent text-accent-fg absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-xs font-bold">
        {reportsPending.count > 9 ? "9+" : reportsPending.count}
      </span>
    {/if}
  </a>
{/snippet}

{#if open}
  <Drawer onclose={close} labelledby="menu-sheet-title" {pull}>
    <div class="shrink-0 px-5 {inAdmin ? 'pt-2 pb-2' : 'pb-1'}">
      <h2
        id="menu-sheet-title"
        class="font-display text-xl font-extrabold tracking-tight {inAdmin
          ? ''
          : 'sr-only'}">
        {inAdmin ? m.nav_administration() : m.common_menu()}
      </h2>
    </div>

    <div
      data-drawer-scroll
      class="min-h-0 flex-1 touch-pan-y overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {#if inAdmin}
        <div class="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {@render tile({
            href: "/app/admin",
            label: m.common_overview(),
            icon: "home",
            match: (path) => path === "/app/admin",
          })}
        </div>
        {#each VISIBLE_ADMIN_NAV_GROUPS as group (group.label)}
          <section class="mt-4 first:mt-2">
            <div class="mb-2.5 flex items-center gap-3">
              <span
                class="timecode text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                {group.label}
              </span>
              <span class="bg-border h-px flex-1"></span>
            </div>
            <div class="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {#each group.items as item (item.href)}
                {@render tile(item)}
              {/each}
            </div>
          </section>
        {/each}

        <a
          href="/app"
          onclick={close}
          class="border-border bg-surface-2 hover:border-accent/40 text-fg mt-4 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold">
          <Icon name="chevron-left" class="h-4 w-4" />
          {m.nav_back_to_app()}
        </a>
      {:else}
        <a
          href={profileHref()}
          onclick={close}
          class="bg-surface-2 mt-1 flex items-center gap-3.5 rounded-2xl p-3 transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none">
          {#if auth.user}
            <Avatar
              seed={auth.user.username}
              url={auth.user.avatarUrl}
              size={52} />
          {/if}
          <span class="min-w-0 flex-1">
            <span
              class="font-display block truncate text-lg leading-tight font-extrabold">
              {auth.user?.displayName}
            </span>
            {#if progress}
              <span class="timecode text-dim mt-0.5 block text-xs">
                {m.common_level()}
                {progress.level} · {m.gamification_podium_xp({
                  xp: formatNumber(progressionQuery.data?.xp ?? 0),
                })}
              </span>
              <span
                class="bg-border mt-1.5 block h-1 overflow-hidden rounded-full"
                aria-hidden="true">
                <span
                  class="bg-accent block h-full rounded-full"
                  style="width: {Math.round(levelShare * 100)}%"></span>
              </span>
            {:else}
              <span class="text-dim mt-0.5 block text-sm"
                >{m.nav_profile()}</span>
            {/if}
          </span>
          <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
        </a>

        {#each groups as group, index (group.label)}
          {@const minor = index === groups.length - 1}
          <div class="mt-5">
            <!-- Séance: section label as a timecode with a letterbox hairline. -->
            <div class="mb-1 flex items-center gap-3">
              <span
                class="timecode text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                {group.label}
              </span>
              <span class="bg-border h-px flex-1"></span>
            </div>
            {#each group.items as item (item.id)}
              {@const active = item.match(page.url.pathname)}
              <a
                href={item.href}
                onclick={close}
                aria-current={active ? "page" : undefined}
                class="active:bg-surface-2 relative flex items-center gap-3 rounded-xl px-1 transition-colors duration-150 {minor
                  ? 'min-h-12'
                  : 'min-h-15'} {active ? 'text-accent' : 'text-fg'}">
                <span
                  class="grid shrink-0 place-items-center rounded-full {minor
                    ? 'text-dim size-8'
                    : 'bg-accent/12 text-accent size-10'}">
                  <Icon name={item.icon} class="h-5 w-5" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-semibold">{item.label}</span>
                  {#if item.hint && !minor}
                    <span class="text-dim block truncate text-sm"
                      >{item.hint()}</span>
                  {/if}
                </span>
                {#if item.newBadgeKey && isFeatureNew(item.newBadgeKey)}
                  <span
                    class="bg-accent h-2 w-2 shrink-0 rounded-full"
                    aria-hidden="true"></span>
                {/if}
                {#if !minor}
                  <Icon
                    name="chevron-right"
                    class="text-dim h-4 w-4 shrink-0" />
                {/if}
              </a>
            {/each}
          </div>
        {/each}

        <button
          type="button"
          onclick={signOut}
          class="text-dim mt-4 flex min-h-12 w-full items-center justify-center gap-2 text-sm font-semibold transition-colors duration-150 active:opacity-70">
          <Icon name="logout" class="h-4 w-4" />
          {m.common_logout()}
        </button>
      {/if}
    </div>
  </Drawer>
{/if}
