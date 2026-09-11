<script lang="ts">
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { tick } from "svelte";
  import { scale } from "svelte/transition";
  import {
    computeDropdownPosition,
    type DropdownPosition,
  } from "./dropdown-position";

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
  let positioned = $state(false);
  let triggerElement = $state<HTMLElement | null>(null);
  let panelElement = $state<HTMLDivElement | null>(null);
  let panelPos = $state<DropdownPosition>({
    top: 0,
    left: 0,
    maxWidth: 0,
    maxHeight: 0,
    originY: "top",
  });

  function viewportBounds() {
    const viewport = window.visualViewport;
    return {
      top: viewport?.offsetTop ?? 0,
      left: viewport?.offsetLeft ?? 0,
      width: viewport?.width ?? window.innerWidth,
      height: viewport?.height ?? window.innerHeight,
    };
  }

  function bottomNavigationInset(viewport: ReturnType<typeof viewportBounds>) {
    const viewportBottom = viewport.top + viewport.height;
    const navigation = Array.from(
      document.querySelectorAll<HTMLElement>("[data-mobile-navigation]"),
    ).find((element) => element.getClientRects().length > 0);
    if (!navigation) return 8;

    const rect = navigation.getBoundingClientRect();
    return Math.max(8, viewportBottom - Math.max(viewport.top, rect.top));
  }

  function updatePosition() {
    if (!open || !triggerElement || !panelElement) return;
    const viewport = viewportBounds();
    const trigger = triggerElement.getBoundingClientRect();
    const panel = panelElement.getBoundingClientRect();
    panelPos = computeDropdownPosition({
      trigger,
      panel: {
        width: Math.max(panel.width, panelElement.scrollWidth),
        height: Math.max(panel.height, panelElement.scrollHeight),
      },
      viewport,
      placement,
      bottomInset: bottomNavigationInset(viewport),
    });
    positioned = true;
  }

  function toggle(e: MouseEvent) {
    if (!open) {
      triggerElement = e.currentTarget as HTMLElement;
      positioned = false;
      open = true;
      void tick().then(updatePosition);
    } else {
      close();
    }
  }

  function close() {
    open = false;
  }

  $effect(() => {
    if (!open || !panelElement || !triggerElement) return;
    const viewport = window.visualViewport;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(panelElement);
    observer.observe(triggerElement);
    document.addEventListener("scroll", updatePosition, true);
    viewport?.addEventListener("resize", updatePosition);
    viewport?.addEventListener("scroll", updatePosition);

    return () => {
      observer.disconnect();
      document.removeEventListener("scroll", updatePosition, true);
      viewport?.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("scroll", updatePosition);
    };
  });
</script>

<svelte:window
  onkeydown={(e) => e.key === "Escape" && close()}
  onresize={updatePosition} />

{@render trigger({ open, toggle })}

{#if open}
  <button
    type="button"
    tabindex="-1"
    class="fixed inset-0 z-30 cursor-default"
    aria-label={m.common_close()}
    onclick={(e) => {
      e.stopPropagation();
      close();
    }}></button>
  <div
    bind:this={panelElement}
    {role}
    style="top: {panelPos.top}px; left: {panelPos.left}px; {positioned
      ? `max-width: ${panelPos.maxWidth}px; max-height: ${panelPos.maxHeight}px; transform-origin: center ${panelPos.originY};`
      : 'visibility: hidden;'}"
    transition:scale|global={{ duration: reduced ? 0 : 120, start: 0.95 }}
    class="border-border bg-surface fixed z-40 flex flex-col overflow-hidden rounded-lg border shadow-lg {panelClass}">
    {@render children({ close })}
  </div>
{/if}
