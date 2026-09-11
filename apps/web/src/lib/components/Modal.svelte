<script lang="ts">
  import { dialogFocus } from "$lib/actions/dialogFocus";
  import { scrollLock } from "$lib/actions/scrollLock";
  import { layout } from "$lib/layout.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { fade, scale } from "svelte/transition";
  import Drawer from "./Drawer.svelte";
  import Icon from "./Icon.svelte";

  let {
    title,
    onclose,
    children,
    wide = false,
    blur = false,
    dismissable = true,
    overflowVisible = false,
    initialFocus,
  }: {
    title: string;
    onclose: () => void;
    children: Snippet;
    /** Wider variant (max-w-2xl instead of max-w-md), for content like tables. */
    wide?: boolean;
    blur?: boolean;
    /** When false: no close-X, Escape and backdrop click do nothing. */
    dismissable?: boolean;
    /** Lets content (e.g. a decorative marker) poke outside the card's rounded
     * corners instead of being clipped by `.card`'s `overflow-hidden`. */
    overflowVisible?: boolean;
    /** Element to focus first once the dialog content is mounted. */
    initialFocus?: HTMLElement | null;
  } = $props();

  // Only one of Drawer/dialog is ever mounted — not both at once toggled by
  // CSS `hidden`/`md:flex`. The old always-both approach silently broke any
  // child relying on `bind:this` (scan camera, avatar crop canvas): it
  // grabbed whichever copy happened to mount last, regardless of which one
  // was actually visible.
  //
  // The choice follows the app shell (layout.svelte.ts) rather than a width
  // query of its own: a phone in landscape clears 768px but leaves ~430px of
  // height, where the centered dialog pushed its own action buttons out of
  // view. The bottom sheet handles short viewports — it scrolls its content
  // and can be swiped away.
  const reduced = prefersReducedMotion();
  const isDesktop = $derived(!layout.compact);
</script>

{#snippet header(showClose: boolean)}
  {#if showClose}
    <button
      type="button"
      class="text-dim hover:bg-surface-2 hover:text-fg absolute top-3 right-3 rounded-full p-1.5"
      aria-label={m.common_close()}
      onclick={onclose}>
      <Icon name="x" class="h-5 w-5" />
    </button>
  {/if}
  <h3 id="modal-title" class="font-display mb-4 text-lg font-bold">
    {title}
  </h3>
{/snippet}

{#if isDesktop}
  <!-- Desktop: a centered dialog. Mobile's Drawer already closes on Escape. -->
  <div
    use:scrollLock
    class={`fixed inset-0 z-60 flex items-center justify-center ${blur ? "backdrop-blur-sm" : ""}`}>
    {#if dismissable}
      <button
        type="button"
        data-dialog-backdrop
        tabindex="-1"
        class="absolute inset-0 cursor-default bg-black/60"
        transition:fade|global={{ duration: reduced ? 0 : 180 }}
        aria-label={m.common_close()}
        onclick={onclose}></button>
    {:else}
      <div
        data-dialog-backdrop
        aria-hidden="true"
        class="absolute inset-0 bg-black/60"
        transition:fade|global={{ duration: reduced ? 0 : 180 }}>
      </div>
    {/if}
    <div
      use:dialogFocus={{
        initialFocus,
        onEscape: dismissable ? onclose : undefined,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      transition:scale|global={{ duration: reduced ? 0 : 180, start: 0.9 }}
      class="card relative z-10 max-h-[85svh] w-full overflow-y-auto {wide
        ? 'max-w-2xl'
        : 'max-w-md'} rounded-2xl p-5 {overflowVisible
        ? 'overflow-visible'
        : ''}">
      {@render header(dismissable)}
      {@render children()}
    </div>
  </div>
{:else}
  <!-- Mobile: a real swipe-to-dismiss bottom sheet, same primitive as the nav
       drawer (MenuSheet) — no close cross, the swipe/backdrop tap covers it.
       Stacked above FocusOverlay (z-50) since a Modal can be opened from
       within a focused comment on touch. -->
  <Drawer
    {onclose}
    {dismissable}
    {initialFocus}
    labelledby="modal-title"
    zIndex={60}>
    <div
      data-drawer-scroll
      class="relative touch-pan-y overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      {@render header(false)}
      {@render children()}
    </div>
  </Drawer>
{/if}
