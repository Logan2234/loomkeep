<script lang="ts">
  // Premium nav skin — a floating dock detached from the edge, icon-only
  // with a tooltip label on hover, magnified on hover like a dock. Mirrors
  // DesktopSidebar's data/gating but skips the expand/pin mechanic: this
  // skin is deliberately icon-only, so there's nothing to expand.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getAdminReportsPendingCount } from "$lib/api/client";
  import { logout } from "$lib/api/auth";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { ADMIN_NAV } from "$lib/constants/admin-nav";
  import { isDomainEnabled } from "$lib/domains";
  import { isFeatureNew } from "$lib/feature-badges";
  import { NAVIGATION } from "$lib/navigation";
  import { m } from "$lib/paraglide/messages.js";

  let { children } = $props();

  const reportsPendingQuery = createApiQuery(() => ({
    key: keys.admin.reportsPendingCount(),
    fetch: () => getAdminReportsPendingCount().then((r) => r.count),
    refetchInterval: 20_000,
    enabled: auth.isAdmin,
  }));
  const reportsPending = $derived(reportsPendingQuery.data ?? 0);

  const inAdmin = $derived(page.url.pathname.startsWith("/app/admin"));
  const profileHref = $derived(
    appConfig.socialEnabled ? "/app/profile" : "/app/settings",
  );
  const flatItems = $derived(
    NAVIGATION.flatMap((section) =>
      section.items.filter(
        (item) =>
          (!item.domain || isDomainEnabled(item.domain)) &&
          (!item.social || appConfig.socialEnabled) &&
          !item.comingSoon,
      ),
    ),
  );

  async function signOut() {
    await logout();
    await goto("/login");
  }
</script>

<div class="flex min-h-screen">
  <aside
    class="border-border bg-surface/90 sticky top-1/2 z-40 hidden h-fit -translate-y-1/2 flex-col gap-1 rounded-2xl border p-2 shadow-xl backdrop-blur md:ml-4 md:flex">
    {#if inAdmin}
      <div class="group relative">
        <a
          href="/app/admin"
          aria-label={m.nav_overview()}
          aria-current={page.url.pathname === "/app/admin" ? "page" : undefined}
          class="grid h-11 w-11 place-items-center rounded-xl transition-all duration-150 ease-out group-hover:scale-110 {page
            .url.pathname === '/app/admin'
            ? 'bg-accent/15 text-accent'
            : 'text-dim hover:bg-surface-2 hover:text-fg'}">
          <Icon name="home" class="h-5 w-5" />
        </a>
        <span
          class="bg-fg text-bg pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          {m.nav_overview()}
        </span>
      </div>
      <div class="border-border my-1 border-t"></div>
      {#each ADMIN_NAV.filter((item) => !item.devOnly || appConfig.erdEnabled) as item (item.href)}
        {@const active = item.match(page.url.pathname)}
        <div class="group relative">
          <a
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            class="relative grid h-11 w-11 place-items-center rounded-xl transition-all duration-150 ease-out group-hover:scale-110 {active
              ? 'bg-accent/15 text-accent'
              : 'text-dim hover:bg-surface-2 hover:text-fg'}">
            <Icon name={item.icon} class="h-5 w-5" />
            {#if item.href === "/app/admin/reports" && reportsPending > 0}
              <span
                class="bg-accent text-accent-fg absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.55rem] font-bold">
                {reportsPending > 9 ? "9+" : reportsPending}
              </span>
            {/if}
          </a>
          <span
            class="bg-fg text-bg pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
            {item.label}
          </span>
        </div>
      {/each}
      <div class="border-border my-1 border-t"></div>
      <div class="group relative">
        <a
          href="/app"
          aria-label={m.nav_back_to_app()}
          class="text-dim hover:bg-surface-2 hover:text-fg grid h-11 w-11 place-items-center rounded-xl transition-all duration-150 ease-out group-hover:scale-110">
          <Icon name="chevron-left" class="h-5 w-5" />
        </a>
        <span
          class="bg-fg text-bg pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          {m.nav_back_to_app()}
        </span>
      </div>
    {:else}
      {#each flatItems as item (item.href)}
        {@const active = item.match(page.url.pathname)}
        <div class="group relative">
          <a
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            class="relative grid h-11 w-11 place-items-center rounded-xl transition-all duration-150 ease-out group-hover:scale-110 {active
              ? 'bg-accent/15 text-accent'
              : 'text-dim hover:bg-surface-2 hover:text-fg'}">
            <Icon name={item.icon} class="h-5 w-5" />
            {#if item.newBadgeKey && isFeatureNew(item.newBadgeKey)}
              <span
                class="bg-accent ring-surface absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2"
                aria-hidden="true"></span>
            {/if}
          </a>
          <span
            class="bg-fg text-bg pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
            {item.label}
          </span>
        </div>
      {/each}

      {#if auth.isAdmin}
        <div class="border-border my-1 border-t"></div>
        <div class="group relative">
          <a
            href="/app/admin"
            aria-label={m.common_admin()}
            class="text-dim hover:bg-surface-2 hover:text-fg grid h-11 w-11 place-items-center rounded-xl transition-all duration-150 ease-out group-hover:scale-110">
            <Icon name="shield" class="h-5 w-5" />
          </a>
          <span
            class="bg-fg text-bg pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
            {m.common_admin()}
          </span>
        </div>
      {/if}

      <div class="border-border my-1 border-t"></div>
      <div class="group relative">
        <a
          href={profileHref}
          aria-label={auth.user?.displayName}
          class="grid h-11 w-11 place-items-center rounded-xl transition-transform duration-150 ease-out group-hover:scale-110">
          {#if auth.user}
            <Avatar
              seed={auth.user.username}
              url={auth.user.avatarUrl}
              size={30} />
          {/if}
        </a>
        <span
          class="bg-fg text-bg pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          {auth.user?.displayName}
        </span>
      </div>
      <button
        type="button"
        onclick={signOut}
        aria-label={m.common_logout()}
        class="hover:bg-surface-2 text-dim hover:text-danger grid h-11 w-11 place-items-center rounded-xl transition-colors">
        <Icon name="logout" class="h-4 w-4" />
      </button>
    {/if}
  </aside>

  <main class="min-w-0 flex-1">
    {#key page.url.pathname}
      {@render children()}
    {/key}
  </main>
</div>
