<script lang="ts">
  import { page } from "$app/state";
  import { pullMenu } from "#lib/actions/pull-menu.js";
  import { auth } from "#lib/auth.svelte.js";
  import { appConfig } from "#lib/config.svelte.js";
  import { isDomainEnabled } from "#lib/domain-availability.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { mobileNav } from "#lib/mobile-nav.svelte.js";
  import { resolveBottomShortcuts } from "#lib/navigation.js";
  import LibraryTab from "./LibraryTab.svelte";
  import MenuGrabber from "./MenuGrabber.svelte";
  import Avatar from "../Avatar.svelte";
  import NavTab from "./NavTab.svelte";

  // The user's stored order (falls back to the default set) around Library,
  // gated by enabled domains / admin role at render time — a shortcut for a
  // since-disabled feature silently drops out.
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
  style="view-transition-name: mobile-nav"
  class="
    border-border bg-surface fixed inset-x-0
    bottom-0
    z-30 flex
    touch-none border-t
    pt-2.5
    pb-[calc(0.4rem+env(safe-area-inset-bottom))]
    text-center
  ">
  <MenuGrabber />
  {#each items as item (item.id)}
    {#if item.id === "library"}
      <LibraryTab />
    {:else}
      <NavTab
        href={item.href}
        icon={item.icon}
        label={item.label}
        active={item.match(page.url.pathname)}
        glyph={item.id === "profile" && auth.user ? avatar : undefined}>
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

{#snippet avatar()}
  {#if auth.user}
    <span data-profile-target class="block rounded-full">
      <Avatar
        seed={auth.user.username}
        url={auth.user.avatarUrl}
        size={26}
        class="block rounded-full!" />
    </span>
  {/if}
{/snippet}
