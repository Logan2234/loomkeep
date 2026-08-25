<script lang="ts">
  // Premium nav skin — mobile counterpart of ProjectorDockDesktop: a
  // floating pill, detached and centered, rather than a bar pinned to the
  // screen edge. Same item source/gating as the default BottomNavigation.
  import { page } from "$app/state";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { isFeatureNew } from "$lib/feature-badges";
  import {
    DEFAULT_BOTTOM_SHORTCUTS,
    resolveBottomShortcuts,
  } from "$lib/navigation";
  import { m } from "$lib/paraglide/messages.js";

  const items = $derived(
    resolveBottomShortcuts(
      auth.user?.mobileNavShortcuts?.length
        ? auth.user.mobileNavShortcuts
        : DEFAULT_BOTTOM_SHORTCUTS,
      { isDomainEnabled, isAdmin: auth.isAdmin },
    ),
  );

  function openMenu() {
    dispatchEvent(new CustomEvent("mobile-menu-toggle"));
  }
</script>

<nav
  class="
    border-border bg-surface/95 fixed inset-x-4
    z-30 flex items-end
    justify-between rounded-full border
    px-2 py-2
    shadow-xl backdrop-blur
    md:hidden
  "
  style="bottom: calc(1rem + env(safe-area-inset-bottom))">
  {#each items as item (item.id)}
    {#if item.id === "menu"}
      <button
        type="button"
        onclick={openMenu}
        aria-label={m.nav_open_menu()}
        class="text-dim flex flex-1 flex-col items-center gap-0.5 text-[0.6rem] font-semibold">
        <span class="grid h-10 w-10 place-items-center rounded-full">
          <Icon name={item.icon} class="h-5 w-5" />
        </span>
        {item.label}
      </button>
    {:else}
      {@const active = item.match(page.url.pathname)}
      <a
        href={item.href}
        aria-current={active ? "page" : undefined}
        class="relative flex flex-1 flex-col items-center gap-0.5 text-[0.6rem] font-semibold transition-transform duration-200 {active
          ? '-translate-y-2.5'
          : ''}">
        {#if active}
          <span
            class="bg-accent/30 pointer-events-none absolute -bottom-1 h-6 w-10 rounded-full blur-md"
            aria-hidden="true"></span>
        {/if}
        <span
          class="relative grid h-10 w-10 place-items-center rounded-full transition-colors {active
            ? 'bg-accent text-accent-fg shadow-[0_6px_16px_-4px_var(--accent)]'
            : 'text-dim'}">
          <Icon name={item.icon} class="h-5 w-5" />
          {#if item.newBadgeKey && isFeatureNew(item.newBadgeKey)}
            <span
              class="bg-accent ring-surface absolute top-0 right-0 h-2 w-2 rounded-full ring-2"
              aria-hidden="true"></span>
          {/if}
        </span>
        <span class={active ? "text-fg" : "text-dim"}>{item.label}</span>
      </a>
    {/if}
  {/each}
</nav>
