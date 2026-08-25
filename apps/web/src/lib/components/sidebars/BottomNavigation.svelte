<script lang="ts">
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

<!-- Séance signature: a "ticket stub" bar — the active tab punches up
     through the line, sitting in a lit amber notch, and the top edge is
     perforated like a torn ticket. -->
<nav
  class="
    border-border bg-surface/95 ticket-edge fixed inset-x-0
    bottom-0
    z-30 flex
    border-t
    pt-2
    pb-[calc(0.4rem+env(safe-area-inset-bottom))]
    backdrop-blur
    md:hidden
  ">
  {#each items as item (item.id)}
    {#if item.id === "menu"}
      <button
        onclick={openMenu}
        aria-label={m.nav_open_menu()}
        class="text-dim flex flex-1 flex-col items-center gap-1 text-[0.62rem] font-semibold">
        <span class="grid h-9 w-9 place-items-center rounded-full">
          <Icon name={item.icon} class="h-5 w-5" />
        </span>
        {item.label}
      </button>
    {:else}
      {@const active = item.match(page.url.pathname)}
      <a
        href={item.href}
        aria-current={active ? "page" : undefined}
        class="
          relative flex flex-1 flex-col items-center gap-1
          text-[0.62rem]
          font-semibold
          transition-transform
          duration-200
          {active ? 'text-accent -translate-y-1.5' : 'text-dim'}
        ">
        {#if active}
          <span
            class="bg-accent/25 pointer-events-none absolute -top-1 h-8 w-8 rounded-full blur-md"
            aria-hidden="true"></span>
        {/if}
        <span
          class="relative grid h-9 w-9 place-items-center rounded-full transition-colors {active
            ? 'bg-accent text-accent-fg shadow-[0_4px_14px_-2px_var(--accent)]'
            : ''}">
          <Icon name={item.icon} class="h-5 w-5" />
          {#if item.newBadgeKey && isFeatureNew(item.newBadgeKey)}
            <span
              class="bg-accent ring-surface absolute top-0 right-0 h-2 w-2 rounded-full ring-2"
              aria-hidden="true"></span>
          {/if}
        </span>

        {item.label}
      </a>
    {/if}
  {/each}
</nav>

<style>
  /* Sprocket holes along the top edge — a 35mm frame line, quiet unless you
     look closely. */
  .ticket-edge {
    background-image: radial-gradient(
      circle,
      var(--border) 1.1px,
      transparent 1.2px
    );
    background-size: 18px 100%;
    background-position: top center;
    background-repeat: repeat-x;
    background-origin: border-box;
  }
</style>
