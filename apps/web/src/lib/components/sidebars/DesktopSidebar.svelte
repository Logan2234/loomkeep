<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { navigating, page } from "$app/state";
  import { getAdminReportsPendingCount } from "$lib/api/client";
  import { logout } from "$lib/api/auth";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { ADMIN_NAV } from "$lib/constants/admin-nav";
  import { isDomainEnabled } from "$lib/domains";
  import { isFeatureNew } from "$lib/feature-badges";
  import { prefersReducedMotion } from "$lib/motion";
  import { NAVIGATION } from "$lib/navigation";
  import { m } from "$lib/paraglide/messages.js";
  import { scale } from "svelte/transition";

  const reduced = prefersReducedMotion();

  let pinned = $state(
    browser ? localStorage.getItem("tl-rail-pinned") === "true" : false,
  );
  let hovered = $state(false);

  // A rail link swaps the page under a stationary cursor, which can fire
  // mouseleave with no mouseenter to follow — the rail would collapse with
  // the mouse still on it. A leave mid-navigation says nothing about where
  // the pointer actually is.
  function onRailLeave() {
    if (navigating.to) return;
    hovered = false;
  }
  let expanded = $derived(pinned || hovered);

  let { children } = $props();

  const reportsPendingQuery = createApiQuery(() => ({
    key: keys.admin.reportsPendingCount(),
    fetch: () => getAdminReportsPendingCount().then((r) => r.count),
    refetchInterval: 20_000,
    enabled: auth.isAdmin,
  }));
  const reportsPending = $derived(reportsPendingQuery.data ?? 0);

  const inAdmin = $derived(page.url.pathname.startsWith("/app/admin"));

  // "Mon profil" only exists when social is enabled — self-host without it
  // still needs a way to the account settings from the sidebar footer.
  const profileHref = $derived(
    appConfig.socialEnabled ? "/app/profile" : "/app/settings",
  );

  async function signOut() {
    await logout();
    await goto("/login");
  }

  function togglePinned() {
    pinned = !pinned;
    if (browser) {
      localStorage.setItem("tl-rail-pinned", pinned ? "true" : "false");
    }
  }

  // Scrollable nav: when the item list is taller than the viewport, the list
  // scrolls on its own while the actions below stay pinned. Fades at the top
  // and bottom edges signal that more items exist out of view.
  let navEl = $state<HTMLElement | null>(null);
  let atTop = $state(true);
  let atBottom = $state(true);

  function updateScroll() {
    const el = navEl;
    if (!el) return;
    atTop = el.scrollTop <= 1;
    atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
  }

  // Séance signature: a single tinted pill slides between items instead of
  // each one carrying its own static highlight — the marquee "chaser light"
  // landing on the current showtime. Measured off `aria-current="page"`
  // rather than tracked separately, so it always matches the real active
  // link.
  let indicatorTop = $state(0);
  let indicatorHeight = $state(0);
  let indicatorVisible = $state(false);

  function positionIndicator() {
    const el = navEl;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!active) {
      indicatorVisible = false;
      return;
    }
    indicatorTop = active.offsetTop;
    indicatorHeight = active.offsetHeight;
    indicatorVisible = true;
  }

  $effect(() => {
    window.addEventListener("resize", updateScroll);
    updateScroll();
    return () => window.removeEventListener("resize", updateScroll);
  });

  // Recompute when the rendered list changes height (rail width or admin vs
  // app navigation) or the active route changes.
  $effect(() => {
    void expanded;
    void inAdmin;
    void page.url.pathname;
    updateScroll();
    positionIndicator();
  });
</script>

<div class="flex min-h-screen">
  <aside
    class="border-border bg-surface sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r px-3 py-3 transition-[width] duration-200 md:flex
    {expanded ? 'w-60' : 'w-16'}"
    onmouseenter={() => (hovered = true)}
    onmouseleave={onRailLeave}>
    <div class="mb-2 flex items-center justify-between overflow-hidden">
      <a href="/app" class="flex min-w-0 items-center overflow-hidden">
        <span
          class="font-display text-accent grid h-10 w-10 shrink-0 place-items-center text-xl font-extrabold">
          L
        </span>

        <span
          class="font-display text-lg font-extrabold whitespace-nowrap transition-opacity
          {expanded ? 'opacity-100' : 'opacity-0'}">
          {m.common_loomkeep()}
        </span>
      </a>

      {#if expanded}
        <button
          type="button"
          onclick={togglePinned}
          title={pinned ? m.nav_unpin_panel() : m.nav_pin_panel()}
          aria-label={pinned ? m.nav_unpin_panel() : m.nav_pin_panel()}
          aria-pressed={pinned}
          class="hover:bg-surface-2 text-dim grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors">
          <Icon name={pinned ? "pin-filled" : "pin"} class="h-4 w-4" />
        </button>
      {/if}
    </div>

    <div class="relative flex min-h-0 flex-1 flex-col">
      <nav
        bind:this={navEl}
        onscroll={updateScroll}
        class="tl-rail-scroll relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <div
          class="bg-accent/15 pointer-events-none absolute inset-x-0 rounded-xl transition-[top,height,opacity] duration-300 ease-out {indicatorVisible
            ? 'opacity-100'
            : 'opacity-0'}"
          style="top: {indicatorTop}px; height: {indicatorHeight}px"
          aria-hidden="true">
        </div>

        {#if inAdmin}
          <a
            href="/app/admin"
            aria-current={page.url.pathname === "/app/admin"
              ? "page"
              : undefined}
            title={expanded ? undefined : m.common_overview()}
            class="flex w-full shrink-0 items-center overflow-hidden rounded-xl transition-colors {page
              .url.pathname === '/app/admin'
              ? 'text-accent'
              : 'text-dim hover:bg-surface-2 hover:text-fg'}">
            <span class="grid h-10 w-10 shrink-0 place-items-center">
              <Icon name="home" class="h-5 w-5" />
            </span>
            <span
              class="text-sm font-semibold whitespace-nowrap transition-opacity duration-150 {expanded
                ? 'opacity-100'
                : 'opacity-0'}">
              {m.common_overview()}
            </span>
          </a>

          {#if expanded}
            <div
              class="text-dim sticky top-0 px-3 pt-3 pb-2 text-[0.6rem] font-bold tracking-[0.13em] uppercase">
              {m.nav_administration()}
            </div>
          {:else}
            <div
              class="border-border mx-3 mt-4.5 mb-4 border-t"
              aria-hidden="true">
            </div>
          {/if}

          {#each ADMIN_NAV.filter((item) => !item.devOnly || appConfig.erdEnabled) as item (item.href)}
            {@const active = item.match(page.url.pathname)}
            <a
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={expanded ? undefined : item.label}
              class="flex w-full shrink-0 items-center overflow-hidden rounded-xl transition-colors {active
                ? 'text-accent'
                : 'text-dim hover:bg-surface-2 hover:text-fg'}">
              <span class="relative grid h-10 w-10 shrink-0 place-items-center">
                <Icon name={item.icon} class="h-5 w-5" />
                {#if item.href === "/app/admin/reports" && reportsPending > 0}
                  {#key reportsPending}
                    <span
                      in:scale|global={{
                        duration: reduced ? 0 : 200,
                        start: 0.5,
                      }}
                      class="bg-accent text-accent-fg absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.55rem] font-bold">
                      {reportsPending > 9 ? "9+" : reportsPending}
                    </span>
                  {/key}
                {/if}
              </span>
              <span
                class="text-sm font-semibold whitespace-nowrap transition-opacity duration-150 {expanded
                  ? 'opacity-100'
                  : 'opacity-0'}">
                {item.label}
              </span>
            </a>
          {/each}
        {:else}
          {#each NAVIGATION as section (section.label)}
            {#if section.label && expanded}
              <div
                class="text-dim px-3 pt-3 pb-2 text-[0.6rem] font-bold tracking-widest whitespace-nowrap uppercase">
                {section.label}
              </div>
            {:else if section.label}
              <div
                class="border-border mx-3 mt-4.5 mb-4 border-t"
                aria-hidden="true">
              </div>
            {/if}

            {#each section.items.filter((item) => (!item.domain || isDomainEnabled(item.domain)) && (!item.social || appConfig.socialEnabled)) as item (item.href)}
              {#if item.comingSoon}
                <!-- Planned domain: non-clickable, with a "Bientôt" badge. -->
                <div
                  title={expanded
                    ? undefined
                    : m.nav_coming_soon_title({ label: item.label })}
                  class="text-dim/70 flex shrink-0 cursor-default items-center overflow-hidden rounded-xl">
                  <span class="grid h-10 w-10 shrink-0 place-items-center">
                    <Icon name={item.icon} class="h-5 w-5" />
                  </span>
                  <span
                    class="flex flex-1 items-center gap-2 pr-2 transition-opacity
                  {expanded ? 'opacity-100' : 'opacity-0'}">
                    <span class="text-sm font-semibold whitespace-nowrap">
                      {item.label}
                    </span>
                    <span
                      class="bg-surface-2 text-dim ml-auto rounded-full px-2 py-0.5 text-[0.6rem] font-bold whitespace-nowrap">
                      {m.common_coming_soon()}
                    </span>
                  </span>
                </div>
              {:else}
                {@const active = item.match(page.url.pathname)}

                <a
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={expanded ? undefined : item.label}
                  class="
                flex shrink-0 items-center overflow-hidden rounded-xl
                transition-colors
                {active
                    ? 'text-accent'
                    : 'text-dim hover:bg-surface-2 hover:text-fg'}
                ">
                  <span
                    class="relative grid h-10 w-10 shrink-0 place-items-center">
                    <Icon name={item.icon} class="h-5 w-5" />
                    {#if item.newBadgeKey && isFeatureNew(item.newBadgeKey)}
                      <span
                        class="bg-accent ring-surface absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2"
                        aria-hidden="true"></span>
                    {/if}
                  </span>

                  <span
                    class="flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-opacity
                  {expanded ? 'opacity-100' : 'opacity-0'}">
                    {item.label}
                    {#if item.newBadgeKey && isFeatureNew(item.newBadgeKey)}
                      <NewBadge />
                    {/if}
                  </span>
                </a>
              {/if}
            {/each}
          {/each}
        {/if}
      </nav>

      <div
        class="from-surface pointer-events-none absolute inset-x-0 top-0 h-5 bg-linear-to-b to-transparent transition-opacity duration-150 {atTop
          ? 'opacity-0'
          : 'opacity-100'}"
        aria-hidden="true">
      </div>
      <div
        class="from-surface pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-linear-to-t to-transparent transition-opacity duration-150 {atBottom
          ? 'opacity-0'
          : 'opacity-100'}"
        aria-hidden="true">
      </div>
    </div>

    <div class="border-border mt-2 flex flex-col gap-1 border-t pt-2">
      {#if auth.isAdmin && !inAdmin}
        <a
          href="/app/admin"
          title={expanded ? undefined : m.common_admin()}
          aria-current={page.url.pathname.startsWith("/app/admin")
            ? "page"
            : undefined}
          class="flex w-full items-center overflow-hidden rounded-xl transition-colors {page.url.pathname.startsWith(
            '/app/admin',
          )
            ? 'bg-accent/15 text-accent'
            : 'text-dim hover:bg-surface-2 hover:text-fg'}">
          <span class="grid h-10 w-10 shrink-0 place-items-center">
            <Icon name="shield" class="h-5 w-5" />
          </span>
          <span
            class="text-sm font-semibold whitespace-nowrap transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            {m.common_admin()}
          </span>
        </a>
      {/if}

      {#if !inAdmin}
        <div class="my-1 flex w-full items-center gap-1 overflow-hidden">
          <a
            href={profileHref}
            title={expanded ? undefined : auth.user?.displayName}
            class="hover:bg-surface-2 flex min-w-0 flex-1 items-center overflow-hidden rounded-xl transition-colors {page.url.pathname.startsWith(
              profileHref,
            )
              ? 'bg-surface-2'
              : ''}">
            <span class="grid h-10 w-10 shrink-0 place-items-center">
              {#if auth.user}
                <Avatar
                  seed={auth.user.username}
                  url={auth.user.avatarUrl}
                  size={32} />
              {/if}
            </span>
            <span
              class="text-fg truncate text-sm font-semibold transition-opacity duration-150 {expanded
                ? 'opacity-100'
                : 'opacity-0'}">
              {auth.user?.displayName}
            </span>
          </a>

          {#if expanded}
            <button
              type="button"
              onclick={signOut}
              title={m.common_logout()}
              aria-label={m.common_logout()}
              class="hover:bg-surface-2 text-dim hover:text-danger grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors">
              <Icon name="logout" class="h-4 w-4" />
            </button>
          {/if}
        </div>
      {:else}
        <a
          href="/app"
          title={expanded ? undefined : m.nav_back_to_app()}
          class="hover:bg-surface-2 hover:text-fg my-1 flex w-full items-center overflow-hidden rounded-xl transition-colors">
          <span class="grid h-10 w-10 shrink-0 place-items-center">
            <Icon name="chevron-left" class="h-5 w-5" />
          </span>
          <span
            class="text-sm font-semibold whitespace-nowrap transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            {m.nav_app_label()}
          </span>
        </a>
      {/if}
    </div>
  </aside>

  <main class="min-w-0 flex-1">
    {#key page.url.pathname}
      {@render children()}
    {/key}
  </main>
</div>

<style>
  /* Hide the native scrollbar in the narrow rail; the edge fades convey that
     the list scrolls. */
  .tl-rail-scroll {
    scrollbar-width: none;
  }
  .tl-rail-scroll::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
</style>
