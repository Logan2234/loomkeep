<script lang="ts">
  import { page } from "$app/state";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import {
    DEFAULT_BOTTOM_SHORTCUTS,
    resolveBottomShortcuts,
  } from "$lib/navigation";

  // The user's stored order (falls back to the default set), gated by enabled
  // domains / admin role at render time — a shortcut for a since-disabled domain
  // silently drops out.
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
    border-border bg-surface/95 fixed inset-x-0
    bottom-0
    z-30 flex
    border-t
    pb-[env(safe-area-inset-bottom)]
    backdrop-blur
    md:hidden
  ">
  {#each items as item (item.id)}
    {#if item.id === "menu"}
      <button
        onclick={openMenu}
        aria-label="Ouvrir le menu"
        class="text-dim relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.62rem] font-semibold">
        <Icon name={item.icon} class="h-6 w-6" />
        {item.label}
      </button>
    {:else}
      {@const active = item.match(page.url.pathname)}
      <a
        href={item.href}
        aria-current={active ? "page" : undefined}
        class="
          flex flex-1 flex-col items-center gap-0.5
          py-2.5
          text-[0.62rem]
          font-semibold
          transition-colors
          {active ? 'text-accent' : 'text-dim'}
        ">
        <Icon name={item.icon} class="h-6 w-6" />

        {item.label}
      </a>
    {/if}
  {/each}
</nav>
