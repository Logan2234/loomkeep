<script lang="ts">
  // Generic mobile long-press result: blurs the background and centers a
  // snippet of content on screen with a contextual menu underneath — the
  // touch equivalent of a desktop hover-reveal action row. Content-agnostic:
  // callers supply what to show (a comment card today; a review/list/library
  // item tomorrow) and what actions to offer.
  //
  // Animation is driven by a local `visible` flag + CSS transitions rather
  // than Svelte `transition:` directives — see Drawer.svelte for why (a
  // transition: here, combined with use:portal, left content stuck on
  // screen, unclickable, after closing).
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { portal } from "$lib/actions/portal";
  import { scrollLock } from "$lib/actions/scrollLock";
  import { m } from "$lib/paraglide/messages.js";

  let {
    onclose,
    content,
    menu,
  }: { onclose: () => void; content: Snippet; menu?: Snippet } = $props();

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dur = reduced ? 0 : 180;

  let visible = $state(false);
  let closing = $state(false);

  onMount(() => {
    requestAnimationFrame(() => (visible = true));
  });

  function requestClose() {
    if (closing) return;
    closing = true;
    visible = false;
    setTimeout(onclose, dur);
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && requestClose()} />

<div
  use:portal
  use:scrollLock
  class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-5"
  role="dialog"
  aria-modal="true"
  aria-label="Actions">
  <button
    class="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity {visible
      ? 'opacity-100'
      : 'pointer-events-none opacity-0'}"
    style="transition-duration: {dur}ms"
    aria-label={m.common_close()}
    onclick={requestClose}></button>

  <div
    class="relative z-10 w-full max-w-sm origin-center transition-[transform,opacity] {visible
      ? 'scale-100 opacity-100'
      : 'pointer-events-none scale-90 opacity-0'}"
    style="transition-duration: {dur}ms">
    {@render content()}
  </div>

  {#if menu}
    <div
      class="border-border bg-surface relative z-10 w-full max-w-sm origin-center overflow-hidden rounded-2xl border shadow-2xl transition-[transform,opacity] {visible
        ? 'scale-100 opacity-100'
        : 'pointer-events-none scale-90 opacity-0'}"
      style="transition-duration: {dur}ms">
      {@render menu()}
    </div>
  {/if}
</div>
