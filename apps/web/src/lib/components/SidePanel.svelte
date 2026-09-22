<script lang="ts">
  import { dialogFocus } from "$lib/actions/dialogFocus";
  import { portal } from "$lib/actions/portal";
  import { scrollLock } from "$lib/actions/scrollLock";
  import { layout } from "$lib/layout.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";

  let {
    onclose,
    children,
    labelledby,
    zIndex = 50,
    panelClass = "",
    desktopClass = "max-w-xl",
    backdropClass = "bg-transparent",
  }: {
    onclose: () => void;
    children: Snippet;
    labelledby?: string;
    zIndex?: number;
    panelClass?: string;
    /** Applied only outside the compact shell so phone panels stay full screen. */
    desktopClass?: string;
    backdropClass?: string;
  } = $props();

  const reduced = prefersReducedMotion();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    // A nested modal owns Escape; the panel remains available beneath it.
    if (document.querySelectorAll('[role="dialog"]').length > 1) return;
    onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div use:portal use:scrollLock class="contents">
  <button
    class="fixed inset-0 cursor-default {backdropClass}"
    style="z-index: {zIndex}"
    aria-label={m.common_close()}
    onclick={onclose}></button>
  <div
    use:dialogFocus
    role="dialog"
    aria-modal="true"
    aria-labelledby={labelledby}
    tabindex="-1"
    transition:fly={{
      x: reduced ? 0 : 28,
      duration: reduced ? 0 : 220,
    }}
    class="bg-bg border-border fixed z-10 flex flex-col overflow-hidden shadow-2xl {layout.compact
      ? 'inset-0 h-[100dvh] w-full'
      : `inset-y-0 right-0 h-full w-full border-l ${desktopClass}`} {panelClass}"
    style="z-index: {zIndex + 1}">
    {@render children()}
  </div>
</div>
