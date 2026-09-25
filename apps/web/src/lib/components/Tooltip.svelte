<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount, tick } from "svelte";
  import { scale } from "svelte/transition";
  import {
    computeTooltipPosition,
    type TooltipPosition,
  } from "./tooltip-position";

  let {
    text,
    placement = "top",
    class: className = "",
    children,
  }: {
    /** Shown in the floating bubble. */
    text: string;
    placement?: "top" | "bottom";
    class?: string;
    children: Snippet;
  } = $props();

  const componentId = $props.id();
  const id = `tooltip-${componentId}`;

  // Touch devices have no real hover, so tapping toggles the bubble instead —
  // checked once, hover capability doesn't change mid-session. On a device
  // that *does* support hover, clicking must stay a no-op for the tooltip
  // (e.g. tapping a disabled button inside shouldn't pin it open and block
  // it from closing on mouseleave).
  const supportsHover =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches;

  // The element wrapping `children` — often a disabled button — is what
  // gets hovered/tapped, not `children` itself: a disabled control doesn't
  // fire mouse events, so listeners live here instead.
  let wrapperEl: HTMLElement | undefined = $state();
  let tooltipEl: HTMLElement | undefined = $state();
  let triggerEl: HTMLElement | undefined = $state();
  let hasKeyboardTrigger = $state(false);
  let open = $state(false);
  let positioned = $state(false);
  // Positioned `fixed` from the wrapper's own rect rather than `absolute`
  // within it. A `relative` wrapper is still clipped by any ancestor's
  // `overflow-hidden` (e.g. `.card`), so scroll and viewport changes keep the
  // fixed position synchronized while the bubble is open.
  let pos = $state<TooltipPosition>({
    top: 0,
    left: 0,
    placement: "top",
  });
  let pointerWithin = false;
  let focusWithin = false;

  function viewportBounds() {
    const viewport = window.visualViewport;
    return {
      top: viewport?.offsetTop ?? 0,
      left: viewport?.offsetLeft ?? 0,
      width: viewport?.width ?? window.innerWidth,
      height: viewport?.height ?? window.innerHeight,
    };
  }

  function computePos() {
    if (!wrapperEl || !tooltipEl) return;
    const trigger = (triggerEl ?? wrapperEl).getBoundingClientRect();
    const tooltip = tooltipEl.getBoundingClientRect();
    pos = computeTooltipPosition({
      trigger,
      tooltip: { width: tooltip.width, height: tooltip.height },
      viewport: viewportBounds(),
      placement,
    });
    positioned = true;
  }

  function show() {
    positioned = false;
    open = true;
    void tick().then(computePos);
  }

  function close() {
    open = false;
  }

  function onPointerEnter() {
    pointerWithin = true;
    if (supportsHover) show();
  }

  function onPointerLeave() {
    pointerWithin = false;
    if (!focusWithin) close();
  }

  function onFocusIn() {
    focusWithin = true;
    show();
  }

  function onFocusOut(e: FocusEvent) {
    if (wrapperEl?.contains(e.relatedTarget as Node | null)) return;
    focusWithin = false;
    if (!pointerWithin) close();
  }

  function tap(e: MouseEvent) {
    if (supportsHover) return;
    e.stopPropagation();
    if (open) close();
    else show();
  }

  function onWrapperKeydown(e: KeyboardEvent) {
    if (
      hasKeyboardTrigger ||
      e.target !== e.currentTarget ||
      (e.key !== "Enter" && e.key !== " ")
    ) {
      return;
    }
    e.preventDefault();
    if (open) close();
    else show();
  }

  function closeOnOutsideClick() {
    if (!supportsHover) open = false;
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (open && e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  onMount(() => {
    if (!wrapperEl) return;
    triggerEl =
      wrapperEl.querySelector<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex], [role="button"]',
      ) ?? undefined;
    hasKeyboardTrigger = Boolean(
      triggerEl && !triggerEl.matches(':disabled, [tabindex="-1"]'),
    );
    if (!triggerEl) return;

    const previous = triggerEl.getAttribute("aria-describedby");
    triggerEl.setAttribute(
      "aria-describedby",
      previous ? `${previous} ${id}` : id,
    );
    return () => {
      if (previous) triggerEl?.setAttribute("aria-describedby", previous);
      else triggerEl?.removeAttribute("aria-describedby");
    };
  });

  $effect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    document.addEventListener("scroll", computePos, true);
    viewport?.addEventListener("scroll", computePos);
    viewport?.addEventListener("resize", computePos);

    return () => {
      document.removeEventListener("scroll", computePos, true);
      viewport?.removeEventListener("scroll", computePos);
      viewport?.removeEventListener("resize", computePos);
    };
  });
</script>

<svelte:window
  onclick={closeOnOutsideClick}
  onkeydown={onWindowKeydown}
  onresize={() => open && computePos()} />

<!-- The wrapper is only focusable when the snippet has no keyboard-reachable trigger. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
  bind:this={wrapperEl}
  class="relative {className}"
  data-escape-consumer={open ? "" : undefined}
  role={hasKeyboardTrigger ? "presentation" : "button"}
  tabindex={hasKeyboardTrigger ? undefined : 0}
  aria-describedby={hasKeyboardTrigger ? undefined : id}
  onmouseenter={onPointerEnter}
  onmouseleave={onPointerLeave}
  onfocusin={onFocusIn}
  onfocusout={onFocusOut}
  onkeydown={onWrapperKeydown}
  onclick={tap}>
  {@render children()}
  {#if open}
    <span
      bind:this={tooltipEl}
      {id}
      role="tooltip"
      style="top: {pos.top}px; left: {pos.left}px; visibility: {positioned
        ? 'visible'
        : 'hidden'}; transform-origin: center {pos.placement === 'top'
        ? 'bottom'
        : 'top'};"
      transition:scale|global={{ duration: 120, start: 0.9 }}
      class="border-border bg-surface text-fg pointer-events-none fixed z-50 max-w-[min(20rem,calc(100vw-1rem))] rounded-lg border px-2.5 py-1.5 text-xs font-medium break-words whitespace-normal shadow-lg">
      {text}
    </span>
  {/if}
</span>
