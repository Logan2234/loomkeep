<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { ADMIN_NAV } from "$lib/admin-nav";
  import { adminReports } from "$lib/admin-reports.svelte";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { NAVIGATION } from "$lib/navigation";
  import { notifications } from "$lib/notifications.svelte";

  // Pinned = stays open regardless of hover, persisted. Unpinned = follows the
  // mouse (hover-only), as before.
  let pinned = $state(
    browser ? localStorage.getItem("tl-rail-pinned") === "true" : false,
  );
  let hovered = $state(false);
  let expanded = $derived(pinned || hovered);

  let { children } = $props();

  const inAdmin = $derived(page.url.pathname.startsWith("/admin"));

  // "Mon profil" only exists when social is enabled — self-host without it
  // still needs a way to the account settings from the sidebar footer.
  const profileHref = $derived(
    appConfig.socialEnabled ? "/profile" : "/settings",
  );

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

  $effect(() => {
    window.addEventListener("resize", updateScroll);
    updateScroll();
    return () => window.removeEventListener("resize", updateScroll);
  });

  // Recompute when the rendered list changes height (rail width, admin vs app
  // navigation, or a new notification badge shifting layout).
  $effect(() => {
    void expanded;
    void inAdmin;
    void notifications.unread;
    updateScroll();
  });
</script>

<div class="flex min-h-screen">
  <aside
    class="border-border bg-surface sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r px-3 py-3 transition-[width] duration-200 md:flex
    {expanded ? 'w-60' : 'w-16'}"
    onmouseenter={() => (hovered = true)}
    onmouseleave={() => (hovered = false)}>
    <div class="mb-2 flex items-center justify-between overflow-hidden">
      <a href="/" class="flex min-w-0 items-center overflow-hidden">
        <span
          class="font-display text-accent grid h-10 w-10 shrink-0 place-items-center text-xl font-extrabold">
          T
        </span>

        <span
          class="font-display text-lg font-extrabold whitespace-nowrap transition-opacity
          {expanded ? 'opacity-100' : 'opacity-0'}">
          Loomkeep
        </span>
      </a>

      {#if expanded}
        <button
          type="button"
          onclick={togglePinned}
          title={pinned
            ? "Désépingler le panneau"
            : "Épingler le panneau ouvert"}
          aria-label={pinned
            ? "Désépingler le panneau"
            : "Épingler le panneau ouvert"}
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
        class="tl-rail-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {#if inAdmin}
          <a
            href="/admin"
            aria-current={page.url.pathname === "/admin" ? "page" : undefined}
            title={expanded ? undefined : "Vue d’ensemble"}
            class="flex w-full shrink-0 items-center overflow-hidden rounded-xl transition-colors {page
              .url.pathname === '/admin'
              ? 'bg-accent/15 text-accent'
              : 'text-dim hover:bg-surface-2 hover:text-fg'}">
            <span class="grid h-10 w-10 shrink-0 place-items-center">
              <Icon name="home" class="h-5 w-5" />
            </span>
            <span
              class="text-sm font-semibold whitespace-nowrap transition-opacity duration-150 {expanded
                ? 'opacity-100'
                : 'opacity-0'}">
              Vue d’ensemble
            </span>
          </a>

          {#if expanded}
            <div
              class="text-dim sticky top-0 px-3 pt-3 pb-2 text-[0.6rem] font-bold tracking-[0.13em] uppercase">
              Administration
            </div>
          {:else}
            <div
              class="border-border mx-3 mt-4.5 mb-4 border-t"
              aria-hidden="true">
            </div>
          {/if}

          {#each ADMIN_NAV as item (item.href)}
            {@const active = item.match(page.url.pathname)}
            <a
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={expanded ? undefined : item.label}
              class="flex w-full shrink-0 items-center overflow-hidden rounded-xl transition-colors {active
                ? 'bg-accent/15 text-accent'
                : 'text-dim hover:bg-surface-2 hover:text-fg'}">
              <span class="relative grid h-10 w-10 shrink-0 place-items-center">
                <Icon name={item.icon} class="h-5 w-5" />
                {#if item.href === "/admin/reports" && adminReports.pending > 0}
                  <span
                    class="bg-accent text-accent-fg absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.55rem] font-bold">
                    {adminReports.pending > 9 ? "9+" : adminReports.pending}
                  </span>
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
                  title={expanded ? undefined : `${item.label} — bientôt`}
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
                      Bientôt
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
                    ? 'bg-accent/15 text-accent'
                    : 'text-dim hover:bg-surface-2 hover:text-fg'}
                ">
                  <span class="grid h-10 w-10 shrink-0 place-items-center">
                    <Icon name={item.icon} class="h-5 w-5" />
                  </span>

                  <span
                    class="text-sm font-semibold whitespace-nowrap transition-opacity
                  {expanded ? 'opacity-100' : 'opacity-0'}">
                    {item.label}
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
          href="/admin"
          title={expanded ? undefined : "Admin"}
          aria-current={page.url.pathname.startsWith("/admin")
            ? "page"
            : undefined}
          class="flex w-full items-center overflow-hidden rounded-xl transition-colors {page.url.pathname.startsWith(
            '/admin',
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
            Admin
          </span>
        </a>
      {/if}

      {#if !inAdmin}
        <a
          href="/notifications"
          title={expanded ? undefined : "Notifications"}
          aria-current={page.url.pathname.startsWith("/notifications")
            ? "page"
            : undefined}
          class="flex w-full items-center overflow-hidden rounded-xl transition-colors {page.url.pathname.startsWith(
            '/notifications',
          )
            ? 'bg-accent/15 text-accent'
            : 'text-dim hover:bg-surface-2 hover:text-fg'}">
          <span class="relative grid h-10 w-10 shrink-0 place-items-center">
            <Icon name="bell" class="h-5 w-5" />
            {#if notifications.unread > 0}
              <span
                class="bg-accent text-accent-fg absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.55rem] font-bold">
                {notifications.unread > 9 ? "9+" : notifications.unread}
              </span>
            {/if}
          </span>
          <span
            class="text-sm font-semibold whitespace-nowrap transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            Notifications
          </span>
        </a>
      {/if}

      {#if !inAdmin}
        <a
          href={profileHref}
          title={expanded ? undefined : auth.user?.displayName}
          class="hover:bg-surface-2 my-1 flex w-full items-center overflow-hidden rounded-xl transition-colors {page.url.pathname.startsWith(
            profileHref,
          )
            ? 'bg-surface-2'
            : ''}">
          <span class="grid h-10 w-10 shrink-0 place-items-center">
            {#if auth.user}
              <Avatar seed={auth.user.username} size={32} />
            {/if}
          </span>
          <span
            class="text-fg truncate text-sm font-semibold transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            {auth.user?.displayName}
          </span>
        </a>
      {:else}
        <a
          href="/"
          title={expanded ? undefined : "Retour à l’application"}
          class="hover:bg-surface-2 hover:text-fg my-1 flex w-full items-center overflow-hidden rounded-xl transition-colors">
          <span class="grid h-10 w-10 shrink-0 place-items-center">
            <Icon name="chevron-left" class="h-5 w-5" />
          </span>
          <span
            class="text-sm font-semibold whitespace-nowrap transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            Application
          </span>
        </a>
      {/if}
    </div>
  </aside>

  <main class="min-w-0 flex-1">
    {@render children()}
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
