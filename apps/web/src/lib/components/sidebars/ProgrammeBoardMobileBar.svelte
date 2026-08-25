<script lang="ts">
  // Premium nav skin — mobile counterpart of ProgrammeBoardDesktop: every
  // primary destination gets its own frame in a horizontally scrollable
  // "filmstrip" tray, sprocket holes on both edges, rather than a fixed set
  // of shortcuts. "Menu" stays last for the destinations this strip has no
  // room for (settings, profile, admin…).
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { isFeatureNew } from "$lib/feature-badges";
  import { NAVIGATION } from "$lib/navigation";
  import { m } from "$lib/paraglide/messages.js";

  const items = $derived(
    NAVIGATION.flatMap((section) => section.items).filter(
      (item) =>
        (!item.domain || isDomainEnabled(item.domain)) &&
        (!item.social || appConfig.socialEnabled) &&
        !item.comingSoon,
    ),
  );

  function openMenu() {
    dispatchEvent(new CustomEvent("mobile-menu-toggle"));
  }
</script>

<nav
  class="
    border-border bg-surface/95 no-scrollbar filmstrip fixed inset-x-0
    bottom-0
    z-30 flex gap-1
    overflow-x-auto border-t
    px-2 pt-2
    pb-[calc(0.5rem+env(safe-area-inset-bottom))]
    backdrop-blur
    md:hidden
  ">
  {#each items as item (item.href)}
    {@const active = item.match(page.url.pathname)}
    <a
      href={item.href}
      aria-current={active ? "page" : undefined}
      class="relative flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-[0.6rem] font-semibold transition-all duration-150 {active
        ? 'bg-accent/10 text-accent -translate-y-1'
        : 'text-dim'}">
      <Icon name={item.icon} class="h-5 w-5" />
      {item.label}
      {#if item.newBadgeKey && isFeatureNew(item.newBadgeKey)}
        <span
          class="bg-accent absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full"
          aria-hidden="true"></span>
      {/if}
    </a>
  {/each}

  <button
    type="button"
    onclick={openMenu}
    aria-label={m.nav_open_menu()}
    class="text-dim flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-[0.6rem] font-semibold">
    <Icon name="menu" class="h-5 w-5" />
    {m.nav_menu()}
  </button>
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
