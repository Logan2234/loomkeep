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
  import { getEnabledOptionIndex } from "./list-navigation";

  const reduced = prefersReducedMotion();

  let {
    placement = "bottom-start",
    role = "menu",
    class: panelClass = "",
    trigger,
    children,
  }: {
    placement?: "bottom-start" | "bottom-end";
    role?: "menu" | "listbox" | "presentation";
    class?: string;
    trigger: Snippet<
      [
        {
          open: boolean;
          toggle: (e: Event) => void;
          close: () => void;
          onkeydown: (e: KeyboardEvent) => void;
        },
      ]
    >;
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
    const nextPosition = computeDropdownPosition({
      trigger,
      panel: {
        width: Math.max(panel.width, panelElement.scrollWidth),
        height: Math.max(panel.height, panelElement.scrollHeight),
      },
      viewport,
      placement,
      bottomInset: bottomNavigationInset(viewport),
    });
    if (
      nextPosition.top !== panelPos.top ||
      nextPosition.left !== panelPos.left ||
      nextPosition.maxWidth !== panelPos.maxWidth ||
      nextPosition.maxHeight !== panelPos.maxHeight ||
      nextPosition.originY !== panelPos.originY
    ) {
      panelPos = nextPosition;
    }
    positioned = true;
  }

  function openPanel(e: Event, focus?: "first" | "last") {
    triggerElement = e.currentTarget as HTMLElement;
    positioned = false;
    open = true;
    void tick().then(() => {
      updatePosition();
      if (focus) focusMenuItem(focus);
    });
  }

  function toggle(e: Event) {
    if (!open) {
      openPanel(e, role === "menu" ? "first" : undefined);
    } else {
      close();
    }
  }

  function close() {
    open = false;
    void tick().then(() => triggerElement?.focus());
  }

  function menuItems() {
    return Array.from(
      panelElement?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
      ) ?? [],
    );
  }

  function focusMenuItem(command: "next" | "previous" | "first" | "last") {
    const items = menuItems();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const index = getEnabledOptionIndex(items, current, command);
    items.forEach((item) => (item.tabIndex = -1));
    if (index >= 0) {
      items[index].tabIndex = 0;
      items[index].focus();
    }
  }

  function onTriggerKeydown(e: KeyboardEvent) {
    if (role !== "menu") return;
    const command =
      e.key === "ArrowDown"
        ? "next"
        : e.key === "ArrowUp"
          ? "previous"
          : e.key === "Home"
            ? "first"
            : e.key === "End"
              ? "last"
              : undefined;
    if (!command) return;

    e.preventDefault();
    if (!open) {
      openPanel(
        e,
        command === "previous" || command === "last" ? "last" : "first",
      );
    } else {
      focusMenuItem(command);
    }
  }

  function onPanelKeydown(e: KeyboardEvent) {
    if (role !== "menu") return;
    if (e.key === "Tab") {
      queueMicrotask(() => (open = false));
      return;
    }
    const command =
      e.key === "ArrowDown"
        ? "next"
        : e.key === "ArrowUp"
          ? "previous"
          : e.key === "Home"
            ? "first"
            : e.key === "End"
              ? "last"
              : undefined;
    if (!command) return;

    e.preventDefault();
    focusMenuItem(command);
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (open && e.key === "Escape") {
      e.preventDefault();
      close();
    }
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

<svelte:window onkeydown={onWindowKeydown} onresize={updatePosition} />

{@render trigger({ open, toggle, close, onkeydown: onTriggerKeydown })}

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
    data-escape-consumer
    role={role === "presentation" ? undefined : role}
    style="top: {panelPos.top}px; left: {panelPos.left}px; {positioned
      ? `max-width: ${panelPos.maxWidth}px; max-height: ${panelPos.maxHeight}px; transform-origin: center ${panelPos.originY};`
      : 'visibility: hidden;'}"
    transition:scale|global={{ duration: reduced ? 0 : 120, start: 0.95 }}
    onkeydown={onPanelKeydown}
    class="border-border bg-surface fixed z-40 flex flex-col overflow-hidden rounded-lg border shadow-lg {panelClass}">
    {@render children({ close })}
  </div>
{/if}
