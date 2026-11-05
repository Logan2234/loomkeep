<script lang="ts">
  import { page } from "$app/state";
  import { auth } from "#lib/auth.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { isDomainEnabled } from "#lib/domain-availability.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { profileHref, visibleNavItems } from "#lib/navigation.js";
  import { pullMenu } from "#lib/actions/pull-menu.js";
  import type { NavTabLook } from "#lib/components/sidebars/NavTab.svelte";
  import LibraryTab from "#lib/components/sidebars/LibraryTab.svelte";
  import MenuGrabber from "#lib/components/sidebars/MenuGrabber.svelte";

  const TAB_LOOK: NavTabLook = {
    root: "shrink-0 gap-1 rounded-lg px-3 py-2 text-[0.6rem]",
    rootActive: "bg-accent/10 text-accent -translate-y-1",
    slot: "h-5 w-5",
    slotActive: "",
    glow: "",
  };

  // The domains are behind Library, right after Search.
  const items = $derived(
    visibleNavItems(
      {
        isDomainEnabled,
        socialEnabled: appConfig.socialEnabled,
        gamificationEnabled: appConfig.gamificationEnabled,
      },
      { includeComingSoon: false },
    ).filter((item) => !item.domain),
  );
</script>

<!-- The strip scrolls sideways; a pull up anywhere on it opens the menu. -->
<nav
  data-mobile-navigation
  use:pullMenu
  class="
    border-border bg-surface/95 filmstrip fixed inset-x-0
    bottom-0
    z-30 border-t
    backdrop-blur
  ">
  <MenuGrabber />
  <div
    class="no-scrollbar flex touch-pan-x gap-1 overflow-x-auto px-2 pt-2.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
    {#each items as item (item.href)}
      {@const active = item.match(page.url.pathname)}
      <a
        href={item.href}
        aria-current={active ? "page" : undefined}
        class="relative flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-[0.6rem] font-semibold transition-all duration-150 {active
          ? 'bg-accent/10 text-accent -translate-y-1'
          : 'text-dim'}">
        {#if item.href === profileHref() && auth.user}
          <span data-profile-target class="block rounded-full">
            <Avatar
              seed={auth.user.username}
              url={auth.user.avatarUrl}
              size={22}
              class="block rounded-full!" />
          </span>
        {:else}
          <Icon name={item.icon} class="h-5 w-5" />
        {/if}
        {item.label}
        {#if item.newBadgeKey && isFeatureNew(item.newBadgeKey)}
          <span
            class="bg-accent absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full"
            aria-hidden="true"></span>
        {/if}
      </a>
      {#if item.href === "/app/search"}
        <LibraryTab look={TAB_LOOK} />
      {/if}
    {/each}
  </div>
</nav>

<style>
  /* Sprocket holes on both edges of the filmstrip tray. */
  .filmstrip {
    background-image:
      radial-gradient(circle, var(--border) 1.1px, transparent 1.2px),
      radial-gradient(circle, var(--border) 1.1px, transparent 1.2px);
    background-size:
      16px 100%,
      16px 100%;
    background-position:
      top center,
      bottom center;
    background-repeat: repeat-x, repeat-x;
  }
</style>
