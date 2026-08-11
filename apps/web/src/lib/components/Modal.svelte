<script lang="ts">
  import type { Snippet } from "svelte";
  import { m } from "$lib/paraglide/messages.js";
  import Drawer from "./Drawer.svelte";
  import Icon from "./Icon.svelte";

  let {
    title,
    onclose,
    children,
    wide = false,
  }: {
    title: string;
    onclose: () => void;
    children: Snippet;
    /** Wider variant (max-w-2xl instead of max-w-md), for content like tables. */
    wide?: boolean;
  } = $props();

  // Only one of Drawer/dialog is ever mounted, picked by the same breakpoint
  // as Tailwind's `md:` — not both at once toggled by CSS `hidden`/`md:flex`.
  // The old always-both approach silently broke any child relying on
  // `bind:this` (scan camera, avatar crop canvas): it grabbed whichever copy
  // happened to mount last, regardless of which one was actually visible.
  const QUERY = "(min-width: 768px)";
  let isDesktop = $state(
    typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  );

  $effect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => (isDesktop = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
</script>

<!-- Mobile's Drawer already closes on Escape via its own listener. -->
<svelte:window
  onkeydown={(e) => isDesktop && e.key === "Escape" && onclose()} />

{#snippet header(showClose: boolean)}
  {#if showClose}
    <button
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
  <div class="fixed inset-0 z-[60] flex items-center justify-center">
    <button
      class="absolute inset-0 cursor-default bg-black/60"
      aria-label={m.common_close()}
      onclick={onclose}></button>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      class="card relative z-10 w-full {wide
        ? 'max-w-2xl'
        : 'max-w-md'} rounded-2xl p-5">
      {@render header(true)}
      {@render children()}
    </div>
  </div>
{:else}
  <!-- Mobile: a real swipe-to-dismiss bottom sheet, same primitive as the nav
       drawer (MenuSheet) — no close cross, the swipe/backdrop tap covers it.
       Stacked above FocusOverlay (z-50) since a Modal can be opened from
       within a focused comment on touch. -->
  <Drawer {onclose} labelledby="modal-title" zIndex={60}>
    <div
      data-drawer-scroll
      class="relative touch-pan-y overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      {@render header(false)}
      {@render children()}
    </div>
  </Drawer>
{/if}
