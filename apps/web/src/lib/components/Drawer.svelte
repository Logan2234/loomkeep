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
  import { dialogFocus } from "#lib/actions/dialog-focus.js";
  import { portal } from "#lib/actions/portal.js";
  import { scrollLock } from "#lib/actions/scroll-lock.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { dimSystemBars } from "#lib/native/shell-bars.js";
  import {
    DragVelocity,
    isDismissed,
    settleDuration,
    sheetStop,
    type SheetStop,
  } from "#lib/swipe-dismiss.js";
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
    label,
    halfOpen = false,
    pull = null,
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
    /** Accessible name, when no element in the sheet can label it. */
    label?: string;
    /** A long sheet opens halfway and is pulled up to read the rest. Not for
     * a sheet with actions pinned at its bottom: they'd start off screen. */
    halfOpen?: boolean;
    /** How far a finger has pulled the sheet up, while it does: MenuSheet's,
     * pulled from the bottom bar. Back to null when it lifts, and the sheet
     * finishes opening or falls back, as a released swipe-down would. */
    pull?: number | null;
  } = $props();

  // JS transitions ignore prefers-reduced-motion, so gate duration manually.
  const reduced = prefersReducedMotion();
  const dur = reduced ? 0 : 220;
  const CLOSE_MS = reduced ? 0 : 180;
  // Decelerates: quick out of the gesture or the edge, gentle into place.
  const SETTLE_CURVE = "cubic-bezier(0.2, 0, 0, 1)";
  const LEAVE_CURVE = "cubic-bezier(0.3, 0, 1, 1)";
  /** Taller than this share of the screen, a halfOpen sheet stops halfway. */
  const HALF_FROM = 0.6;
  const HALF_SHOWS = 0.5;

  let visible = $state(false);
  let closing = $state(false);

  onMount(() => {
    // Next frame so the initial (off-screen/transparent) state paints first
    // — otherwise there's nothing for the enter transition to animate from.
    requestAnimationFrame(() => {
      if (halfOpen && panelEl) {
        const height = panelEl.offsetHeight;
        if (height > innerHeight * HALF_FROM) {
          halfAt = height - innerHeight * HALF_SHOWS;
          rest = halfAt;
        }
      }
      // Opened from a timer (a long press), this frame may be the first one:
      // without a computed starting point there would be nothing to slide from.
      void panelEl?.offsetHeight;
      visible = true;
    });
    return dimSystemBars();
  });

  function requestClose(ms = CLOSE_MS, curve = LEAVE_CURVE) {
    if (closing) return;
    closing = true;
    settle = { ms, curve };
    visible = false;
    setTimeout(onclose, ms);
  }

  /** Closes with the sheet's own animation, for a caller holding a reference. */
  export function close() {
    requestClose();
  }

  let panelEl = $state<HTMLDivElement | null>(null);
  let dragging = $state(false);
  let dragY = $state(0);
  // How far below fully open the sheet rests, and its half-open stop if any.
  let rest = $state(0);
  let halfAt = 0;
  let settle = $state({ ms: dur, curve: SETTLE_CURVE });
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

  // Beyond this fraction of the panel's height, or released in a flick,
  // a drag completes the close instead of snapping back.
  const CLOSE_FRACTION = 0.3;
  const velocity = new DragVelocity();

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
    velocity.reset();
    velocity.add(e.clientY, e.timeStamp);
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
      if (rest > 0 && delta < 0) {
        gesture = "drag";
        dragging = true;
      } else if (gestureScroller && delta < 0) {
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
      dragY = Math.max(0, rest + delta);
      velocity.add(e.clientY, e.timeStamp);
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
    if (gesture !== "drag") {
      cancelGesture();
      return;
    }
    const speed = velocity.at(e.timeStamp);
    const stop: SheetStop =
      halfAt > 0
        ? sheetStop({
            position: dragY,
            halfAt,
            size: panelHeight,
            velocity: speed,
            from: rest > 0 ? "half" : "full",
            fraction: CLOSE_FRACTION,
          })
        : isDismissed({
              distance: dragY,
              size: panelHeight,
              velocity: speed,
              fraction: CLOSE_FRACTION,
            })
          ? "closed"
          : "full";
    const target =
      stop === "closed" ? panelHeight : stop === "half" ? halfAt : 0;
    const ms = reduced ? 0 : settleDuration(Math.abs(target - dragY), speed);
    cancelGesture();
    if (stop === "closed") {
      requestClose(ms, SETTLE_CURVE);
      return;
    }
    settle = { ms, curve: SETTLE_CURVE };
    rest = target;
  }

  // A sheet pulled up follows the finger, and is let go like a dragged one:
  // past a share of its height, or flicked up, it opens.
  const OPEN_FRACTION = 0.3;
  const pulling = $derived(pull !== null);
  const pullVelocity = new DragVelocity();
  let pulledTo = 0;
  let wasPulling = false;

  $effect(() => {
    if (pull === null) return;
    pulledTo = pull;
    pullVelocity.add(pull, performance.now());
  });

  $effect(() => {
    if (wasPulling && !pulling) releasePull();
    wasPulling = pulling;
  });

  function releasePull() {
    const height = panelEl?.offsetHeight || 1;
    const speed = pullVelocity.at(performance.now());
    pullVelocity.reset();
    const opens =
      speed >= 0
        ? isDismissed({
            distance: pulledTo,
            size: height,
            velocity: speed,
            fraction: OPEN_FRACTION,
          })
        : pulledTo > height * (1 - OPEN_FRACTION);
    if (!opens) {
      requestClose(reduced ? 0 : settleDuration(pulledTo, speed), SETTLE_CURVE);
      return;
    }
    settle = {
      ms: reduced ? 0 : settleDuration(height - pulledTo, speed),
      curve: SETTLE_CURVE,
    };
    rest = 0;
  }

  const pulledShare = $derived(
    pulling ? Math.min(1, (pull ?? 0) / (panelEl?.offsetHeight || 1)) : 1,
  );

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
      style="z-index: {zIndex}; {pulling
        ? `opacity: ${pulledShare}; transition: none`
        : `transition-duration: ${dur}ms`}"
      aria-label={m.common_close()}
      onclick={() => requestClose()}></button>
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
      onEscape: dismissable ? () => requestClose() : undefined,
    }}
    bind:this={panelEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby={labelledby}
    aria-label={label}
    tabindex="-1"
    class="border-border bg-surface fixed inset-x-0 bottom-0 flex max-h-[88dvh] w-full touch-none flex-col rounded-t-3xl border-t shadow-2xl {closing
      ? 'pointer-events-none'
      : ''}"
    style="z-index: {zIndex + 10}; {pulling
      ? `transform: translateY(calc(100% - ${pull}px)); transition: none;`
      : dragging
        ? `transform: translateY(${dragY}px); transition: none;`
        : `transform: translateY(${visible ? `${rest}px` : '100%'}); transition: transform ${settle.ms}ms ${settle.curve};`}"
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
