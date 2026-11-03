<script lang="ts">
  import { page } from "$app/state";
  import { pullMenu } from "#lib/actions/pull-menu.js";
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { isDomainEnabled } from "#lib/domain-availability.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { resolveBottomShortcuts } from "#lib/navigation.js";
  import { mobileNav } from "#lib/mobile-nav.svelte.js";
  import type { NavTabLook } from "#lib/components/sidebars/NavTab.svelte";
  import LibraryTab from "#lib/components/sidebars/LibraryTab.svelte";
  import MenuGrabber from "#lib/components/sidebars/MenuGrabber.svelte";

  const TAB_LOOK: NavTabLook = {
    root: "flex-1 gap-0.5 text-[0.6rem]",
    rootActive: "text-fg -translate-y-2.5",
    slot: "h-10 w-10",
    slotActive:
      "bg-accent text-accent-fg shadow-[0_6px_16px_-4px_var(--accent)]",
    glow: "bg-accent/30 -bottom-1 h-6 w-10",
  };

  const items = $derived(
    resolveBottomShortcuts(mobileNav.shortcuts, {
      isDomainEnabled,
      isAdmin: auth.isAdmin,
      socialEnabled: appConfig.socialEnabled,
      gamificationEnabled: appConfig.gamificationEnabled,
    }),
  );
</script>

<nav
  data-mobile-navigation
  use:pullMenu
  class="
    border-border bg-surface/95 fixed inset-x-4
    z-30 flex touch-none items-end
    justify-between rounded-full border
    px-2 py-2
    shadow-xl backdrop-blur
  "
  style="bottom: calc(1rem + env(safe-area-inset-bottom))">
  <MenuGrabber class="-top-5" />
  {#each items as item (item.id)}
    {#if item.id === "library"}
      <LibraryTab look={TAB_LOOK} />
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
