<script lang="ts" module>
  /** How a bar draws its tabs: the same for a link, Messages and Alerts. */
  export interface NavTabLook {
    root: string;
    rootActive: string;
    slot: string;
    slotActive: string;
    glow: string;
  }

  // Séance signature: a "ticket stub" bar — the active tab punches up through
  // the line, sitting in a lit amber notch.
  export const STUB_LOOK: NavTabLook = {
    root: "flex-1 gap-1 text-[0.6875rem]",
    rootActive: "text-accent -translate-y-1.5",
    slot: "h-9 w-9",
    slotActive:
      "bg-accent text-accent-fg shadow-[0_4px_14px_-2px_var(--accent)]",
    glow: "bg-accent/25 -top-1 h-8 w-8",
  };
</script>

<script lang="ts">
  import { page } from "$app/state";
  import Icon from "#lib/components/Icon.svelte";
  import { scrollUpOnReselect } from "#lib/navigation.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import type { Snippet } from "svelte";

  let {
    href,
    onclick,
    icon,
    label,
    ariaLabel,
    active = false,
    look = STUB_LOOK,
    badge,
  }: {
    href?: string;
    onclick?: () => void;
    icon: IconName;
    label: string;
    ariaLabel?: string;
    active?: boolean;
    look?: NavTabLook;
    /** Over the icon's corner. */
    badge?: Snippet;
  } = $props();

  const rootClass = $derived(
    `relative flex min-w-0 flex-col items-center font-semibold transition-[translate,color] duration-200 ${look.root} ${active ? look.rootActive : "text-dim"}`,
  );
</script>

{#snippet face()}
  {#if active && look.glow}
    <span
      class="pointer-events-none absolute rounded-full blur-md {look.glow}"
      aria-hidden="true"></span>
  {/if}
  <span
    class="relative grid place-items-center rounded-full transition-colors {look.slot} {active
      ? look.slotActive
      : ''}">
    <Icon name={icon} class="h-5 w-5" />
    {@render badge?.()}
  </span>
  <!-- Dropped to screen readers only under 360px, where labels would run into
       each other: the icon and the accessible name stay. The current tab keeps
       its label, to say where you are. -->
  <span class="w-full truncate px-0.5 {active ? '' : 'max-[359px]:sr-only'}"
    >{label}</span>
{/snippet}

{#if href}
  <a
    {href}
    aria-current={active ? "page" : undefined}
    aria-label={ariaLabel}
    onclick={(event) => scrollUpOnReselect(event, href, page.url)}
    class={rootClass}>
    {@render face()}
  </a>
{:else}
  <button type="button" {onclick} aria-label={ariaLabel} class={rootClass}>
    {@render face()}
  </button>
{/if}
