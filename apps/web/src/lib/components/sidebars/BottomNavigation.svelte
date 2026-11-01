<script lang="ts">
  import { page } from "$app/state";
  import { auth } from "#lib/auth.svelte.js";
  import { appConfig } from "#lib/config.svelte.js";
  import { isDomainEnabled } from "#lib/domain-availability.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { mobileNav } from "#lib/mobile-nav.svelte.js";
  import { resolveBottomShortcuts } from "#lib/navigation.js";
  import { m } from "#lib/paraglide/messages.js";
  import ChatTab from "#lib/components/chat/ChatTab.svelte";
  import NavTab from "./NavTab.svelte";
  import NotificationTab from "./NotificationTab.svelte";

  // The user's stored order (falls back to the default set), gated by enabled
  // domains / admin role at render time — a shortcut for a since-disabled domain
  // silently drops out.
  const items = $derived(
    resolveBottomShortcuts(mobileNav.shortcuts, {
      isDomainEnabled,
      isAdmin: auth.isAdmin,
      socialEnabled: appConfig.socialEnabled,
      gamificationEnabled: appConfig.gamificationEnabled,
    }),
  );

  function openMenu() {
    dispatchEvent(new CustomEvent("mobile-menu-toggle"));
  }
</script>

<nav
  data-mobile-navigation
  style="view-transition-name: mobile-nav"
  class="
    border-border bg-surface fixed inset-x-0
    bottom-0
    z-30 flex
    border-t
    pt-2
    pb-[calc(0.4rem+env(safe-area-inset-bottom))]
    text-center
  ">
  {#each items as item (item.id)}
    {#if item.id === "messages"}
      <ChatTab />
    {:else if item.id === "alerts"}
      <NotificationTab />
    {:else if item.id === "menu"}
      <NavTab
        icon={item.icon}
        label={item.label}
        ariaLabel={m.nav_open_menu()}
        onclick={openMenu} />
    {:else}
      <NavTab
        href={item.href}
        icon={item.icon}
        label={item.label}
        active={item.match(page.url.pathname)}>
        {#snippet badge()}
          {#if item.newBadgeKey && isFeatureNew(item.newBadgeKey)}
            <span
              class="bg-accent ring-surface absolute top-0 right-0 h-2 w-2 rounded-full ring-2"
              aria-hidden="true"></span>
          {/if}
        {/snippet}
      </NavTab>
    {/if}
  {/each}
</nav>
