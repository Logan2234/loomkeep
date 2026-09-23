<script lang="ts">
  import { dialogFocus } from "$lib/actions/dialogFocus";
  import { portal } from "$lib/actions/portal";
  import { scrollLock } from "$lib/actions/scrollLock";
  import { layout } from "$lib/layout.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { fade, scale } from "svelte/transition";
  import Drawer from "./Drawer.svelte";
  import Icon from "./Icon.svelte";
  import { MODAL_Z_INDEX } from "./overlay-layers";

  let {
    title,
    eyebrow,
    leading,
    onclose,
    children,
    actions,
    wide = false,
    blur = false,
    dismissable = true,
    overflowVisible = false,
  }: {
    title: string;
    /** Metadata line above the title (timecode voice). */
    eyebrow?: string;
    /** Visual before the title block, e.g. a work's poster thumbnail. */
    leading?: Snippet;
    onclose: () => void;
    children: Snippet;
    /**
     * Confirm/cancel buttons, pinned to the bottom instead of scrolling away
     * with the content. Optional: a modal that renders its own buttons inside
     * `children` still works, they just sit at the end of the scroll.
     */
    actions?: Snippet;
    /** Wider variant (max-w-2xl instead of max-w-md), for content like tables. */
    wide?: boolean;
    blur?: boolean;
    /** When false: no close-X, Escape and backdrop click do nothing. */
    dismissable?: boolean;
    /** Lets content (e.g. a decorative marker) poke outside the card's rounded
     * corners instead of being clipped by `.card`'s `overflow-hidden`. */
    overflowVisible?: boolean;
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

<!-- Mobile's Drawer already closes on Escape via its own listener. -->
<svelte:window
  onkeydown={(e) =>
    isDesktop && dismissable && e.key === "Escape" && onclose()} />

{#snippet header(showClose: boolean)}
  {#if showClose}
    <button
      class="text-dim hover:bg-surface-2 hover:text-fg absolute top-3 right-3 rounded-full p-1.5"
      aria-label={m.common_close()}
      onclick={onclose}>
      <Icon name="x" class="h-5 w-5" />
    </button>
  {/if}
  {#if leading || eyebrow}
    <div class="mb-4 flex items-center gap-3 pr-8">
      {@render leading?.()}
      <div class="min-w-0">
        {#if eyebrow}
          <p class="timecode truncate text-[0.7rem] uppercase">{eyebrow}</p>
        {/if}
        <h3
          id="modal-title"
          class="font-display text-lg leading-tight font-bold text-balance">
          {title}
        </h3>
      </div>
    </div>
  {:else}
    <h3 id="modal-title" class="font-display mb-4 text-lg font-bold">
      {title}
    </h3>
  {/if}
{/snippet}

{#if isDesktop}
  <!-- Desktop: a centered dialog. Mobile's Drawer already closes on Escape. -->
  <div
    use:portal
    use:scrollLock
    class={`fixed inset-0 flex items-center justify-center ${blur ? "backdrop-blur-sm" : ""}`}
    style="z-index: {MODAL_Z_INDEX}">
    <button
      class="absolute inset-0 cursor-default bg-black/60"
      transition:fade|global={{ duration: reduced ? 0 : 180 }}
      aria-label={m.common_close()}
      onclick={() => dismissable && onclose()}></button>
    <div
      use:dialogFocus
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
      transition:scale|global={{ duration: reduced ? 0 : 180, start: 0.9 }}
      class="card relative z-10 flex max-h-[85svh] w-full flex-col {wide
        ? 'max-w-2xl'
        : 'max-w-md'} rounded-2xl {overflowVisible ? 'overflow-visible' : ''}">
      <div
        class="p-5 {overflowVisible
          ? 'overflow-visible'
          : 'min-h-0 flex-1 overflow-y-auto'}">
        {@render header(dismissable)}
        {@render children()}
      </div>
      {#if actions}
        <div class="border-border shrink-0 border-t px-5 py-3">
          {@render actions()}
        </div>
      {/if}
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
    labelledby="modal-title"
    zIndex={MODAL_Z_INDEX}>
    <!-- `min-h-0` is what lets this actually scroll: a flex child defaults to
         `min-height: auto`, so without it the body grew past the sheet's
         max-height and its bottom sat off-screen, unreachable — the sheet
         itself being the only thing that moved. -->
    <div
      data-drawer-scroll
      class="relative min-h-0 flex-1 touch-pan-y overflow-y-auto px-5 {actions
        ? 'pb-4'
        : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))]'}">
      {@render header(false)}
      {@render children()}
    </div>
    {#if actions}
      <div
        class="border-border shrink-0 border-t px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {@render actions()}
      </div>
    {/if}
  </Drawer>
{/if}
