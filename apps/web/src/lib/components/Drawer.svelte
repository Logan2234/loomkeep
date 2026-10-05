<script lang="ts">
  // Generic mobile bottom-sheet: rises from the bottom edge, backdrop behind
  // it, and a real swipe-to-dismiss gesture — dragging anywhere on the panel
  // (not just the grabber) tracks the pointer and closes proportionally to
  // how far down it's dragged, snapping back if released before the
  // threshold. Shared by Modal.svelte (its mobile mode) and MenuSheet.svelte.
  //
  // The panel is a capped flex column, so a caller whose content can outgrow
  // it owes its scrolling child `min-h-0 flex-1 overflow-y-auto touch-pan-y`
  // and `data-drawer-scroll` (see below). Without `min-h-0` that child keeps
  // `min-height: auto`, grows past the panel and hangs its own bottom off
  // the screen, where nothing can reach it — the sheet is the only thing
  // that moves.
  //
  // The enter/exit animation is driven by plain CSS transitions off a local
  // `visible` flag rather than a Svelte `transition:` directive. A
  // transition: directive here previously made Svelte defer destroying the
  // *entire* enclosing block until it finished — which, propagated up
  // through Modal's unrelated desktop dialog markup, caused a visible delay
  // on desktop close, and combined with the portal below, left the panel
  // stuck on screen (unmounted from Svelte's perspective, but not actually
  // detached) after closing on mobile. Calling `onclose` ourselves via
  // setTimeout, only after the local closing animation has finished, makes
  // the parent's unmount instant and unconditional — nothing left for Svelte
  // to defer.
  import { dialogFocus } from "#lib/actions/dialogFocus.js";
  import { portal } from "#lib/actions/portal.js";
  import { scrollLock } from "#lib/actions/scrollLock.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";

  let {
    onclose,
    children,
    labelledby,
    zIndex = 40,
    dismissable = true,
    initialFocus,
  }: {
    onclose: () => void;
    children: Snippet;
    /** id of the element that labels this dialog, for aria-labelledby. */
    labelledby?: string;
    /** Backdrop z-index; the panel sits at zIndex + 10. Bump when a Drawer must
     * stack above another fixed overlay (e.g. Modal opened from within
     * FocusOverlay's focused-comment view). */
    zIndex?: number;
    /** When false: no Escape/backdrop/swipe-down dismissal, no drag grabber. */
    dismissable?: boolean;
    /** Element to focus first once the sheet content is mounted. */
    initialFocus?: HTMLElement | null;
  } = $props();

  // JS transitions ignore prefers-reduced-motion, so gate duration manually.
  const reduced = prefersReducedMotion();
  const dur = reduced ? 0 : 220;

  let visible = $state(false);
  let closing = $state(false);

  onMount(() => {
    // Next frame so the initial (off-screen/transparent) state paints first
    // — otherwise there's nothing for the enter transition to animate from.
    requestAnimationFrame(() => (visible = true));
  });

  function requestClose() {
    if (closing) return;
    closing = true;
    visible = false;
    setTimeout(onclose, dur);
  }

  let panelEl = $state<HTMLDivElement | null>(null);
  let dragging = $state(false);
  let dragY = $state(0);
  let startY = 0;
  let startX = 0;
  let panelHeight = 1;
  let activePointer: number | null = null;
  let gesture: "pending" | "scroll" | "drag" | null = null;
  let gestureScroller: HTMLElement | null = null;
  let gestureMoved = false;

  // At the top, keep the gesture until its direction is known: downward
  // dismisses the sheet, upward scrolls the content manually. Once away
  // from the top, subsequent gestures use native scrolling and momentum.
  // Changing touch-action cannot change ownership of an active gesture.
  $effect(() => {
    if (!panelEl) return;
    const scrollables = Array.from(
      panelEl.querySelectorAll<HTMLElement>("[data-drawer-scroll]"),
    );
    const sync = (el: HTMLElement) => {
      el.style.touchAction = el.scrollTop <= 0 ? "none" : "pan-y";
    };
    const cleanups = scrollables.map((el) => {
      sync(el);
      const onScroll = () => sync(el);
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => el.removeEventListener("scroll", onScroll);
    });
    return () => cleanups.forEach((fn) => fn());
  });

  // Beyond this fraction of the panel's height,
  // a released drag completes the close instead of snapping back.
  const CLOSE_FRACTION = 0.3;

  function onPointerDown(e: PointerEvent) {
    if (closing || activePointer !== null) return;
    gestureMoved = false;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!panelEl) return;
    if (
      e.pointerType !== "touch" &&
      (e.target as Element).closest(
        "button, a[href], input, select, textarea, [contenteditable='true'], [role='button']",
      )
    )
      return;
    // A drag that starts over a scrollable descendant that isn't itself
    // scrolled to the top shouldn't hijack the gesture from that scroller.
    const scrollable = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-drawer-scroll]",
    );
    if (scrollable && scrollable.scrollTop > 0) return;
    if (!dismissable && !scrollable) return;
    activePointer = e.pointerId;
    gesture = "pending";
    gestureScroller = scrollable;
    startY = e.clientY;
    startX = e.clientX;
    panelHeight = panelEl.getBoundingClientRect().height || 1;
  }

  function onPointerMove(e: PointerEvent) {
    if (activePointer !== e.pointerId || !gesture) return;
    const delta = e.clientY - startY;
    if (gesture === "pending") {
      if (Math.abs(delta) < 8) return;
      if (Math.abs(e.clientX - startX) > Math.abs(delta)) {
        cancelGesture();
        return;
      }
      if (gestureScroller && delta < 0) {
        gesture = "scroll";
      } else if (dismissable && delta > 0) {
        gesture = "drag";
        dragging = true;
      } else {
        cancelGesture();
        return;
      }
      gestureMoved = true;
      panelEl?.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    if (gesture === "scroll") {
      gestureScroller!.scrollTop = Math.max(0, -delta);
    } else {
      dragY = Math.max(0, delta);
    }
  }

  function cancelGesture() {
    activePointer = null;
    gesture = null;
    gestureScroller = null;
    dragging = false;
    dragY = 0;
  }

  function onPointerUp(e: PointerEvent) {
    if (activePointer !== e.pointerId) return;
    const close = gesture === "drag" && dragY / panelHeight > CLOSE_FRACTION;
    cancelGesture();
    if (close) requestClose();
  }

  function onClickCapture(e: MouseEvent) {
    if (!gestureMoved || e.detail === 0) return;
    e.preventDefault();
    e.stopPropagation();
  }
</script>

<!-- No `md:hidden` here: the shell decides which surface mounts (see
     layout.svelte.ts), and `scrollLock` runs on mount regardless of CSS,
     so every caller gates this behind a condition rather than a class. -->
<div use:portal use:scrollLock class="contents">
  {#if dismissable}
    <button
      type="button"
      data-dialog-backdrop
      tabindex="-1"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity {visible
        ? 'opacity-100'
        : 'pointer-events-none opacity-0'}"
      style="z-index: {zIndex}; transition-duration: {dur}ms"
      aria-label={m.common_close()}
      onclick={requestClose}></button>
  {:else}
    <div
      data-dialog-backdrop
      aria-hidden="true"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity {visible
        ? 'opacity-100'
        : 'pointer-events-none opacity-0'}"
      style="z-index: {zIndex}; transition-duration: {dur}ms">
    </div>
  {/if}

  <div
    use:dialogFocus={{
      initialFocus,
      onEscape: dismissable ? requestClose : undefined,
    }}
    bind:this={panelEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby={labelledby}
    tabindex="-1"
    class="border-border bg-surface fixed inset-x-0 bottom-0 flex max-h-[88dvh] w-full touch-none flex-col rounded-t-3xl border-t shadow-2xl {closing
      ? 'pointer-events-none'
      : ''}"
    style="z-index: {zIndex + 10}; {dragging
      ? `transform: translateY(${dragY}px); transition: none;`
      : `transform: translateY(${visible ? '0' : '100%'}); transition: transform ${dur}ms ease;`}"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={cancelGesture}
    onclickcapture={onClickCapture}>
    <div class="shrink-0 pt-3 pb-1 select-none">
      {#if dismissable}
        <div class="bg-border mx-auto h-1 w-9 rounded-full"></div>
      {/if}
    </div>
    {@render children()}
  </div>
</div>
