<script lang="ts">
  // Premium nav skin — a fixed-width, icon-only rail that never expands in
  // place. Hovering (or tabbing into) it slides out a dark "directory
  // board" overlay, styled after a cinema programme board: each entry gets
  // a small amber pin-light instead of a background highlight.
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

  let open = $state(false);

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
  const visibleSections = $derived(
    NAVIGATION.map((section) => ({
      label: section.label,
      items: section.items.filter(
        (item) =>
          (!item.domain || isDomainEnabled(item.domain)) &&
          (!item.social || appConfig.socialEnabled) &&
          (!item.gamification || appConfig.gamificationEnabled) &&
          !item.comingSoon,
      ),
    })).filter((section) => section.items.length > 0),
  );

  async function signOut() {
    await logout();
    await goto("/login");
  }
</script>

{#snippet railIcon(item: {
  href: string;
  icon: import("$lib/types/icon-name").IconName;
  label: string;
  match: (p: string) => boolean;
})}
  {@const active = item.match(page.url.pathname)}
  <a
    href={item.href}
    aria-current={active ? "page" : undefined}
    aria-label={item.label}
    class="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors {active
      ? 'bg-accent/15 text-accent'
      : 'text-dim hover:bg-surface-2 hover:text-fg'}">
    <Icon name={item.icon} class="h-5 w-5" />
  </a>
{/snippet}

<div class="flex min-h-screen">
  <div
    class="relative hidden md:block"
    role="group"
    onmouseenter={() => (open = true)}
    onmouseleave={() => (open = false)}
    onfocusin={() => (open = true)}
    onfocusout={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) open = false;
    }}>
    <aside
      class="border-border bg-surface sticky top-0 flex h-screen w-16 shrink-0 flex-col items-center gap-1 border-r py-4">
      {#if inAdmin}
        {@render railIcon({
          href: "/app/admin",
          icon: "home",
          label: m.common_overview(),
          match: (p) => p === "/app/admin",
        })}
        {#each ADMIN_NAV.filter((item) => !item.devOnly || appConfig.erdEnabled) as item (item.href)}
          {@render railIcon(item)}
        {/each}
      {:else}
        {#each visibleSections as section (section.label ?? "primary")}
          {#each section.items as item (item.href)}
            {@render railIcon(item)}
          {/each}
        {/each}
        {#if auth.isAdmin}
          {@render railIcon({
            href: "/app/admin",
            icon: "shield",
            label: m.common_admin(),
            match: (p) => p.startsWith("/app/admin"),
          })}
        {/if}
      {/if}

      <div class="mt-auto">
        {#if auth.user}
          <a href={profileHref} aria-label={auth.user.displayName}>
            <Avatar
              seed={auth.user.username}
              url={auth.user.avatarUrl}
              size={34} />
          </a>
        {/if}
      </div>
    </aside>

    <!-- Directory board overlay -->
    <div
      class="fixed top-0 left-16 z-30 h-screen w-64 border-r border-black/20 bg-[#0c0d10] px-4 py-5 text-[#ececea] shadow-2xl transition-transform duration-200 ease-out {open
        ? 'translate-x-0 opacity-100'
        : 'pointer-events-none -translate-x-4 opacity-0'}">
      <p
        class="mb-4 font-mono text-[0.62rem] font-bold tracking-[0.2em] text-[#f5b841]">
        {inAdmin ? m.nav_administration() : m.common_menu()}
      </p>

      {#if inAdmin}
        <a
          href="/app/admin"
          aria-current={page.url.pathname === "/app/admin" ? "page" : undefined}
          class="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold transition-colors {page
            .url.pathname === '/app/admin'
            ? 'text-[#f5b841]'
            : 'text-white/75 hover:bg-white/5 hover:text-white'}">
          <span
            class="h-1.5 w-1.5 shrink-0 rounded-full {page.url.pathname ===
            '/app/admin'
              ? 'bg-[#f5b841] shadow-[0_0_6px_1px_#f5b841]'
              : 'bg-white/15'}"></span>
          {m.common_overview()}
        </a>
        {#each ADMIN_NAV.filter((item) => !item.devOnly || appConfig.erdEnabled) as item (item.href)}
          {@const active = item.match(page.url.pathname)}
          <a
            href={item.href}
            aria-current={active ? "page" : undefined}
            class="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold transition-colors {active
              ? 'text-[#f5b841]'
              : 'text-white/75 hover:bg-white/5 hover:text-white'}">
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full {active
                ? 'bg-[#f5b841] shadow-[0_0_6px_1px_#f5b841]'
                : 'bg-white/15'}"></span>
            {item.label}
            {#if item.href === "/app/admin/reports" && reportsPending > 0}
              <span
                class="ml-auto rounded-full bg-[#f5b841] px-1.5 text-[0.6rem] font-bold text-[#1a1406]">
                {reportsPending > 9 ? "9+" : reportsPending}
              </span>
            {/if}
          </a>
        {/each}
        <a
          href="/app"
          class="mt-4 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-white/75 hover:bg-white/5 hover:text-white">
          <Icon name="chevron-left" class="h-4 w-4" />
          {m.nav_back_to_app()}
        </a>
      {:else}
        {#each visibleSections as section (section.label ?? "primary")}
          {#if section.label}
            <p
              class="mt-4 mb-2 font-mono text-[0.58rem] font-bold tracking-[0.14em] text-white/40 first:mt-0">
              {section.label.toUpperCase()}
            </p>
          {/if}
          {#each section.items as item (item.href)}
            {@const active = item.match(page.url.pathname)}
            <a
              href={item.href}
              aria-current={active ? "page" : undefined}
              class="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold transition-colors {active
                ? 'text-[#f5b841]'
                : 'text-white/75 hover:bg-white/5 hover:text-white'}">
              <span
                class="h-1.5 w-1.5 shrink-0 rounded-full {active
                  ? 'bg-[#f5b841] shadow-[0_0_6px_1px_#f5b841]'
                  : 'bg-white/15'}"></span>
              {item.label}
              {#if item.newBadgeKey && isFeatureNew(item.newBadgeKey)}
                <span
                  class="ml-auto h-1.5 w-1.5 rounded-full bg-[#f5b841]"
                  aria-hidden="true"></span>
              {/if}
            </a>
          {/each}
        {/each}

        {#if auth.isAdmin}
          <p
            class="mt-4 mb-2 font-mono text-[0.58rem] font-bold tracking-[0.14em] text-white/40">
            {m.nav_administration()}
          </p>
          <a
            href="/app/admin"
            class="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-white/75 hover:bg-white/5 hover:text-white">
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-white/15"></span>
            {m.common_admin()}
          </a>
        {/if}

        <div class="mt-5 border-t border-white/10 pt-3">
          <a
            href={profileHref}
            class="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-white/75 hover:bg-white/5 hover:text-white">
            {#if auth.user}
              <Avatar
                seed={auth.user.username}
                url={auth.user.avatarUrl}
                size={20} />
            {/if}
            {auth.user?.displayName}
          </a>
          <button
            type="button"
            onclick={signOut}
            class="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-semibold text-white/50 hover:bg-white/5 hover:text-white">
            <Icon name="logout" class="h-4 w-4" />
            {m.common_logout()}
          </button>
        </div>
      {/if}
    </div>
  </div>

  <main class="min-w-0 flex-1">
    {#key page.url.pathname}
      {@render children()}
    {/key}
  </main>
</div>
