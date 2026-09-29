<script lang="ts">
  // A menu item that opens its own menu to the side, desktop-menu style:
  // on hover, on click (touch) or with → / Enter. ← or Escape goes back.
  // Only valid inside a Dropdown with role="menu". Where neither side has
  // room (a phone), the submenu slides over its parent menu instead, with a
  // "‹ label" row to go back — the usual mobile drill-down.
  import { prefersReducedMotion } from "$lib/motion";
  import type { Snippet } from "svelte";
  import { onDestroy, tick } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { openSubmenu, portal } from "./dropdown-submenu.svelte";
  import Icon from "./Icon.svelte";

  let {
    label,
    checked = false,
    children,
  }: {
    label: string;
    /** Marks the item as holding the current value, like its sibling items. */
    checked?: boolean;
    children: Snippet;
  } = $props();

  const reduced = prefersReducedMotion();
  const GAP = 4;
  const MARGIN = 8;
  // The panel's min-w-44, to decide before it renders whether a side fits.
  const MIN_WIDTH = 176;
  // Lets the pointer cross the gap to the submenu without closing it.
  const CLOSE_DELAY_MS = 180;

  const id = Symbol();
  const open = $derived(openSubmenu.id === id);
  let drill = $state(false);
  let side = $state<"right" | "left">("right");
  let position = $state({ left: 0, top: 0, width: 0, height: 0 });
  let triggerElement = $state<HTMLButtonElement | null>(null);
  let panelElement = $state<HTMLDivElement | null>(null);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  // A mouse hovers before it clicks: the click right after a hover-open
  // must not close what the hover just opened.
  let hoverOpenedAt = 0;

  function items(): HTMLElement[] {
    return Array.from(
      panelElement?.querySelectorAll<HTMLElement>(
        ':is([role="menuitem"], [role="menuitemcheckbox"], input):not(:disabled)',
      ) ?? [],
    ).filter((el) => el.closest('[role="menu"]') === panelElement);
  }

  // Horizontally, the parent menu's outer edge rather than the item's, so
  // the submenu sits beside it instead of over its border.
  function parentRect(): DOMRect | undefined {
    return triggerElement?.parentElement
      ?.closest('[role="menu"]')
      ?.getBoundingClientRect();
  }

  const fitsRight = (parent: DOMRect, width: number) =>
    parent.right + GAP + width + MARGIN <= window.innerWidth;
  const fitsLeft = (parent: DOMRect, width: number) =>
    parent.left - GAP - width - MARGIN >= 0;

  async function show(focusFirst = false) {
    clearTimeout(closeTimer);
    if (!open) {
      const parent = parentRect();
      drill =
        !!parent &&
        !fitsRight(parent, MIN_WIDTH) &&
        !fitsLeft(parent, MIN_WIDTH);
      openSubmenu.id = id;
      await tick();
      place();
    }
    if (focusFirst) items()[0]?.focus();
  }

  function hide(focusTrigger = false) {
    clearTimeout(closeTimer);
    if (open) openSubmenu.id = null;
    if (focusTrigger) triggerElement?.focus();
  }

  function hideSoon() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => hide(), CLOSE_DELAY_MS);
  }

  onDestroy(() => {
    clearTimeout(closeTimer);
    if (openSubmenu.id === id) openSubmenu.id = null;
  });

  function place() {
    const parent = parentRect();
    if (!triggerElement || !panelElement || !parent) return;
    const width = panelElement.offsetWidth;

    if (!drill && fitsRight(parent, width)) {
      side = "right";
      position.left = parent.right + GAP;
    } else if (!drill && fitsLeft(parent, width)) {
      side = "left";
      position.left = parent.left - GAP - width;
    } else {
      drill = true;
      position = {
        left: parent.left,
        top: parent.top,
        width: parent.width,
        height: parent.height,
      };
      return;
    }
    position.top = Math.max(
      MARGIN,
      Math.min(
        triggerElement.getBoundingClientRect().top - GAP,
        window.innerHeight - panelElement.offsetHeight - MARGIN,
      ),
    );
  }

  function onTriggerKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      void show(true);
    }
  }

  function onPanelKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      hide(true);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    e.preventDefault();
    e.stopPropagation();
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? index + 1 : index - 1;
    list[(next + list.length) % list.length]?.focus();
  }

  // Replaced by a sibling: gone at once, so the two never overlap.
  const outDuration = () => (reduced || openSubmenu.id !== null ? 0 : 120);
</script>

<div
  role="none"
  onpointerenter={(e) => e.pointerType === "mouse" && clearTimeout(closeTimer)}
  onpointerleave={(e) => e.pointerType === "mouse" && open && hideSoon()}>
  <button
    bind:this={triggerElement}
    type="button"
    role="menuitem"
    class="menu-item w-full {open ? 'bg-surface-2' : ''}"
    aria-haspopup="menu"
    aria-expanded={open}
    onpointerenter={(e) => {
      if (e.pointerType !== "mouse" || open) return;
      hoverOpenedAt = Date.now();
      void show();
    }}
    onclick={() => {
      if (!open) void show();
      else if (Date.now() - hoverOpenedAt > 500) hide();
    }}
    onkeydown={onTriggerKeydown}>
    <span class="text-accent grid h-4 w-4 place-items-center">
      {#if checked}<Icon name="check" class="h-3.5 w-3.5" />{/if}
    </span>
    <span class="flex-1">{label}</span>
    <Icon
      name="chevron-right"
      class="h-3.5 w-3.5 transition-[transform,color] duration-200 {open
        ? 'text-fg translate-x-0.5'
        : 'text-dim'}" />
  </button>
  {#if open}
    <div
      use:portal
      bind:this={panelElement}
      role="menu"
      tabindex="-1"
      style="left: {position.left}px; top: {position.top}px; {drill
        ? `width: ${position.width}px; min-height: ${position.height}px;`
        : ''}"
      class="border-border bg-surface fixed z-50 flex max-h-[calc(100vh-1rem)] flex-col overflow-y-auto rounded-lg border py-1 shadow-lg {drill
        ? ''
        : 'min-w-44'}"
      in:fly={{
        x: drill ? 24 : side === "right" ? -GAP : GAP,
        duration: reduced ? 0 : drill ? 200 : 170,
        easing: cubicOut,
      }}
      out:fly={{ x: drill ? 24 : 0, duration: outDuration() }}
      onpointerenter={() => clearTimeout(closeTimer)}
      onpointerleave={(e) => e.pointerType === "mouse" && hideSoon()}
      onkeydown={onPanelKeydown}>
      {#if drill}
        <button
          type="button"
          role="menuitem"
          class="menu-item text-dim font-semibold"
          onclick={() => hide(true)}>
          <Icon name="chevron-left" class="h-4 w-4" />
          {label}
        </button>
        <div class="border-border my-1 border-t"></div>
      {/if}
      {@render children()}
    </div>
  {/if}
</div>
