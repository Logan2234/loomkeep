<script lang="ts">
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { setContext, tick } from "svelte";
  import { scale } from "svelte/transition";
  import Drawer from "./Drawer.svelte";
  import { IN_MENU_SHEET } from "./dropdown-submenu.svelte";
  import { MENU_SHEET_Z_INDEX } from "./overlay-layers";
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
    sheetTitle,
    trigger,
    children,
  }: {
    placement?: "bottom-start" | "bottom-end";
    role?: "menu" | "listbox" | "presentation";
    class?: string;
    /** Makes a `presentation` panel a sheet on a phone too, under this title. */
    sheetTitle?: string;
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
  // Fixed when it opens, for a finger only: a narrow window with a mouse keeps
  // the popover and its arrow keys. A panel with a field to type in stays
  // anchored too (searchable Combobox): a sheet would sit under the keyboard.
  let asSheet = $state(false);
  let drawer = $state<{ close: () => void }>();
  setContext(IN_MENU_SHEET, () => asSheet);
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
    if (!open || asSheet || !triggerElement || !panelElement) return;
    const viewport = viewportBounds();
    const trigger = triggerElement.getBoundingClientRect();
    const nextPosition = computeDropdownPosition({
      trigger,
      // offset* ignores the opening scale transition, which would shrink
      // getBoundingClientRect() and cap max-height just below the content.
      panel: {
        width: Math.max(panelElement.offsetWidth, panelElement.scrollWidth),
        height: Math.max(panelElement.offsetHeight, panelElement.scrollHeight),
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
    asSheet =
      layout.compact &&
      matchMedia("(pointer: coarse)").matches &&
      (role !== "presentation" || !!sheetTitle);
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

  function closed() {
    open = false;
    void tick().then(() => triggerElement?.focus());
  }

  function close() {
    if (asSheet) drawer?.close();
    else closed();
  }

  function menuItems() {
    return Array.from(
      panelElement?.querySelectorAll<HTMLElement>(
        ':is([role="menuitem"], [role="menuitemcheckbox"]):not([aria-disabled="true"]):not(:disabled)',
      ) ?? [],
      // A DropdownSubmenu's items belong to its own menu and navigation.
    ).filter((item) => item.closest('[role="menu"]') === panelElement);
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
    if (!open || asSheet || !panelElement || !triggerElement) return;
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

{#if open && asSheet}
  <Drawer
    bind:this={drawer}
    onclose={closed}
    zIndex={MENU_SHEET_Z_INDEX}
    halfOpen
    label={sheetTitle ??
      triggerElement?.getAttribute("aria-label") ??
      triggerElement?.textContent?.trim() ??
      undefined}>
    {#if sheetTitle}
      <p class="font-display shrink-0 px-5 pt-1 pb-2 font-bold">{sheetTitle}</p>
    {/if}
    <div
      bind:this={panelElement}
      data-drawer-scroll
      data-menu-sheet
      data-escape-consumer
      role={role === "presentation" ? undefined : role}
      tabindex="-1"
      onkeydown={onPanelKeydown}
      class="flex min-h-0 w-full! max-w-none! flex-1 touch-pan-y flex-col overflow-y-auto pb-[calc(0.75rem+env(safe-area-inset-bottom))] {panelClass}">
      {@render children({ close })}
    </div>
  </Drawer>
{:else if open}
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
