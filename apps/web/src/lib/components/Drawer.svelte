<script lang="ts">
  // Generic mobile bottom-sheet: rises from the bottom edge, backdrop behind
  // it, and a real swipe-to-dismiss gesture — dragging anywhere on the panel
  // (not just the grabber) tracks the pointer and closes proportionally to
  // how far down it's dragged, snapping back if released before the
  // threshold. Shared by Modal.svelte (its mobile mode) and MenuSheet.svelte.
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
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { portal } from "$lib/actions/portal";
  import { scrollLock } from "$lib/actions/scrollLock";
  import { m } from "$lib/paraglide/messages.js";

  let {
    onclose,
    children,
    labelledby,
    zIndex = 40,
  }: {
    onclose: () => void;
    children: Snippet;
    /** id of the element that labels this dialog, for aria-labelledby. */
    labelledby?: string;
    /** Backdrop z-index; the panel sits at zIndex + 10. Bump when a Drawer must
     * stack above another fixed overlay (e.g. Modal opened from within
     * FocusOverlay's focused-comment view). */
    zIndex?: number;
  } = $props();

  // JS transitions ignore prefers-reduced-motion, so gate duration manually.
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  let panelHeight = 1;

  // A `[data-drawer-scroll]` descendant declares `touch-pan-y` (see Modal/
  // MenuSheet) so it can scroll natively — but that CSS is set once and
  // applies regardless of actual scroll position, so a downward swipe
  // starting at scrollTop 0 (nothing to scroll) still got contested between
  // native panning and our pointer-drag below: the browser would fire
  // pointercancel a frame or two in, snapping the sheet straight back to
  // its resting position before the drag could register (confirmed: this is
  // exactly why dragging only ever worked from the header/grabber, which has
  // no `[data-drawer-scroll]` descendant to compete with). Toggling it to
  // `touch-action: none` while at the top hands the whole gesture to our own
  // pointer handlers instead; back to `pan-y` once scrolled away from the
  // top, where native momentum scrolling should take over again.
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

  // Below this fraction of the panel's height (or past a velocity threshold),
  // a released drag completes the close instead of snapping back.
  const CLOSE_FRACTION = 0.3;

  function onPointerDown(e: PointerEvent) {
    if (closing) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!panelEl) return;
    // A drag that starts over a scrollable descendant that isn't itself
    // scrolled to the top shouldn't hijack the gesture from that scroller.
    const scrollable = (e.target as HTMLElement).closest(
      "[data-drawer-scroll]",
    );
    if (scrollable && scrollable.scrollTop > 0) return;
    dragging = true;
    startY = e.clientY;
    panelHeight = panelEl.getBoundingClientRect().height || 1;
    panelEl.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    e.preventDefault();
    dragY = Math.max(0, e.clientY - startY);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    if (dragY / panelHeight > CLOSE_FRACTION) {
      requestClose();
    } else {
      dragY = 0;
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && requestClose()} />

<div use:portal use:scrollLock class="contents md:hidden">
  <button
    class="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity {visible
      ? 'opacity-100'
      : 'pointer-events-none opacity-0'}"
    style="z-index: {zIndex}; transition-duration: {dur}ms"
    aria-label={m.common_close()}
    onclick={requestClose}></button>

  <div
    bind:this={panelEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby={labelledby}
    tabindex="-1"
    class="border-border bg-surface fixed inset-x-0 bottom-0 flex max-h-[88vh] w-full touch-none flex-col rounded-t-3xl border-t shadow-2xl {closing
      ? 'pointer-events-none'
      : ''}"
    style="z-index: {zIndex + 10}; {dragging
      ? `transform: translateY(${dragY}px); transition: none;`
      : `transform: translateY(${visible ? '0' : '100%'}); transition: transform ${dur}ms ease;`}"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}>
    <div class="shrink-0 pt-3 pb-1 select-none">
      <div class="bg-border mx-auto h-1 w-9 rounded-full"></div>
    </div>
    {@render children()}
  </div>
</div>
