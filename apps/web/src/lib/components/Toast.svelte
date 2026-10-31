<script lang="ts">
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { DragVelocity, isDismissed } from "#lib/swipe-dismiss.js";
  import { toast, type ToastVariant } from "#lib/toast.svelte.js";
  import { flip } from "svelte/animate";
  import { fade, fly } from "svelte/transition";
  import Icon from "./Icon.svelte";

  const reduced = prefersReducedMotion();

  // Hovered or holding focus, a toast stays put: its countdown resumes only
  // once neither the pointer nor the keyboard is on it any more. A finger
  // leaves :hover behind after a tap, so only a mouse counts as hovering.
  function release(el: HTMLElement, id: number, leaving: EventTarget | null) {
    const focused =
      leaving === null
        ? el.contains(document.activeElement)
        : el.contains(leaving as Node);
    const hovered =
      matchMedia("(hover: hover)").matches && el.matches(":hover");
    if (!focused && !hovered) toast.resume(id);
  }

  // Swiped sideways, a toast leaves the way Android's snackbars do; on a
  // phone that is how it closes, the × staying for screen readers only.
  const SWIPE_FRACTION = 0.35;
  const velocity = new DragVelocity();
  let swipe = $state<{ id: number; dx: number; leaving: boolean } | null>(null);
  let swipeStart: { x: number; y: number; pointer: number } | null = null;
  let swiped = false;

  function onSwipeStart(e: PointerEvent, id: number) {
    if (e.pointerType === "mouse" || swipe?.leaving) return;
    swipeStart = { x: e.clientX, y: e.clientY, pointer: e.pointerId };
    swiped = false;
    velocity.reset();
    velocity.add(e.clientX, e.timeStamp);
    swipe = { id, dx: 0, leaving: false };
  }

  function onSwipeMove(e: PointerEvent, id: number) {
    if (!swipeStart || swipeStart.pointer !== e.pointerId || swipe?.id !== id)
      return;
    const dx = e.clientX - swipeStart.x;
    if (!swiped) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(e.clientY - swipeStart.y) > Math.abs(dx)) {
        swipeStart = null;
        swipe = null;
        return;
      }
      swiped = true;
      toast.pause(id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    velocity.add(e.clientX, e.timeStamp);
    swipe = { id, dx, leaving: false };
  }

  function onSwipeEnd(e: PointerEvent, id: number) {
    if (!swipeStart || swipeStart.pointer !== e.pointerId || swipe?.id !== id)
      return;
    swipeStart = null;
    if (!swiped) {
      swipe = null;
      return;
    }
    const el = e.currentTarget as HTMLElement;
    const direction = Math.sign(swipe.dx) || 1;
    const leave = isDismissed({
      distance: Math.abs(swipe.dx),
      size: el.offsetWidth,
      velocity: velocity.at(e.timeStamp) * direction,
      fraction: SWIPE_FRACTION,
    });
    if (!leave) {
      swipe = null;
      release(el, id, null);
      return;
    }
    swipe = { id, dx: direction * el.offsetWidth, leaving: true };
    setTimeout(
      () => {
        toast.dismiss(id);
        swipe = null;
      },
      reduced ? 0 : 150,
    );
  }

  // The tap that ends a swipe must not also press the button under it.
  function onSwipeClick(e: MouseEvent) {
    if (!swiped || e.detail === 0) return;
    swiped = false;
    e.preventDefault();
    e.stopPropagation();
  }

  function swipeStyle(id: number): string | undefined {
    if (swipe?.id !== id || swipe.dx === 0) return undefined;
    const opacity = swipe.leaving
      ? 0
      : 1 - Math.min(Math.abs(swipe.dx) / 320, 0.6);
    const transition =
      swipe.leaving && !reduced
        ? "transition: transform 150ms ease-in, opacity 150ms ease-in;"
        : "transition: none;";
    return `transform: translateX(${swipe.dx}px); opacity: ${opacity}; ${transition}`;
  }

  const VARIANT_STYLES: Record<
    ToastVariant,
    { rail: string; icon: "check" | "warning" | "bell"; iconClass: string }
  > = {
    success: {
      rail: "bg-success",
      icon: "check",
      iconClass: "text-success border-success/30 bg-success/10",
    },
    error: {
      rail: "bg-danger",
      icon: "warning",
      iconClass: "text-danger border-danger/30 bg-danger/10",
    },
    info: {
      rail: "bg-accent",
      icon: "bell",
      iconClass: "text-accent border-accent/30 bg-accent/10",
    },
  };
</script>

{#snippet actionButton(id: number, label: string, index: number)}
  <button
    type="button"
    class="text-accent hover:bg-accent/10 relative shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition-colors after:absolute after:-inset-x-1 after:-inset-y-2.5"
    onclick={() => toast.selectAction(id, index)}>
    {label}
  </button>
{/snippet}

<!-- On a phone, above the bottom bar, whose height includes the system's own
     navigation inset; the shell (not the width) decides, so a phone in
     landscape keeps it clear of the bar too. -->
<div
  class="pointer-events-none fixed z-60 flex flex-col gap-2 {layout.compact
    ? 'inset-x-4 bottom-[calc(var(--bottom-bar-space)+0.5rem)] items-center'
    : 'right-4 bottom-4 items-end'}">
  {#each toast.items as t (t.id)}
    {@const style = VARIANT_STYLES[t.variant]}
    <div
      role="status"
      onpointerenter={(e) => {
        if (e.pointerType === "mouse") toast.pause(t.id);
      }}
      onpointerleave={(e) => {
        if (e.pointerType === "mouse") release(e.currentTarget, t.id, null);
      }}
      onfocusin={() => toast.pause(t.id)}
      onfocusout={(e) => release(e.currentTarget, t.id, e.relatedTarget)}
      onpointerdown={(e) => onSwipeStart(e, t.id)}
      onpointermove={(e) => onSwipeMove(e, t.id)}
      onpointerup={(e) => onSwipeEnd(e, t.id)}
      onpointercancel={(e) => onSwipeEnd(e, t.id)}
      onclickcapture={onSwipeClick}
      style={swipeStyle(t.id)}
      in:fly={{ y: 12, duration: reduced ? 0 : 150 }}
      out:fade={{ duration: reduced ? 0 : 120 }}
      animate:flip={{ duration: reduced ? 0 : 200 }}
      class="toast border-border bg-surface pointer-events-auto relative flex w-full max-w-md touch-pan-y items-center gap-3 overflow-hidden rounded-xl border py-3.5 pr-3 pl-4 text-sm shadow-xl">
      <span class="absolute inset-y-0 left-0 w-1 {style.rail}"></span>
      <span
        class="grid h-7 w-7 shrink-0 place-items-center rounded-lg border {style.iconClass}"
        aria-hidden="true">
        <Icon name={style.icon} class="h-3.5 w-3.5" />
      </span>
      <!-- One action sits beside the message; several go under it, so the
           message keeps its width. -->
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="leading-snug">{t.message}</span>
        {#if t.actions.length > 1}
          <div class="-ml-2.5 flex flex-wrap gap-x-1">
            {#each t.actions as action, index (action.label)}
              {@render actionButton(t.id, action.label, index)}
            {/each}
          </div>
        {/if}
      </div>
      {#if t.actions.length === 1}
        {@render actionButton(t.id, t.actions[0].label, 0)}
      {/if}
      <button
        type="button"
        aria-label={m.common_close()}
        class="text-dim hover:bg-surface-2 hover:text-fg shrink-0 rounded-md p-1 transition-colors {layout.compact
          ? 'sr-only'
          : ''}"
        onclick={() => toast.dismiss(t.id)}>
        <Icon name="x" class="h-3.5 w-3.5" />
      </button>
      {#if t.actions.length > 0 && t.duration > 0}
        <span
          class="toast-countdown bg-accent absolute right-0 bottom-0 h-0.5"
          style={`animation-duration: ${t.duration}ms`}
          aria-hidden="true"></span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toast-countdown {
    width: calc(100% - 0.25rem);
    transform-origin: left;
    animation-name: toast-countdown;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }

  .toast:focus-within .toast-countdown {
    animation-play-state: paused;
  }

  @media (hover: hover) {
    .toast:hover .toast-countdown {
      animation-play-state: paused;
    }
  }

  @keyframes toast-countdown {
    to {
      transform: scaleX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast-countdown {
      animation-name: none;
    }
  }
</style>
