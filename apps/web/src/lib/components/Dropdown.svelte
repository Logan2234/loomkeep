<script lang="ts">
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { scale } from "svelte/transition";

  const reduced = prefersReducedMotion();

  let {
    placement = "bottom-start",
    role = "menu",
    class: panelClass = "",
    trigger,
    children,
  }: {
    placement?: "bottom-start" | "bottom-end";
    role?: "menu" | "listbox";
    class?: string;
    trigger: Snippet<[{ open: boolean; toggle: (e: MouseEvent) => void }]>;
    children: Snippet<[{ close: () => void }]>;
  } = $props();

  let open = $state(false);
  let panelPos = $state({ top: 0, left: 0, right: 0 });

  function toggle(e: MouseEvent) {
    if (!open) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      panelPos = {
        top: rect.bottom + 4,
        left: rect.left,
        right: window.innerWidth - rect.right,
      };
    }
    open = !open;
  }

  function close() {
    open = false;
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === "Escape" && close()}
  onresize={close}
  onscroll={close} />

{@render trigger({ open, toggle })}

{#if open}
  <button
    class="fixed inset-0 z-30 cursor-default"
    aria-label={m.common_close()}
    onclick={close}></button>
  <div
    {role}
    style="top: {panelPos.top}px; {placement === 'bottom-end'
      ? `right: ${panelPos.right}px`
      : `left: ${panelPos.left}px`}"
    transition:scale|global={{ duration: reduced ? 0 : 120, start: 0.95 }}
    class="border-border bg-surface fixed z-40 flex max-h-[min(20rem,calc(100vh-2rem))] flex-col overflow-hidden rounded-lg border shadow-lg {panelClass}">
    {@render children({ close })}
  </div>
{/if}
