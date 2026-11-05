<script lang="ts">
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly, scale } from "svelte/transition";
  import AnimatedHeight from "./AnimatedHeight.svelte";
  import Icon from "./Icon.svelte";
  import ProgressBar from "./ProgressBar.svelte";
  import { normalizeWizardIndex } from "./wizard-state";

  let {
    steps,
    activeIndex,
    canAdvance = true,
    onBack,
    onNext,
    onFinish,
    onJump,
    additionalAction,
    fullscreen = false,
    hint,
    nextLabel,
    asideHeader,
    aside,
    topAction,
    class: cls = "",
    children,
  }: {
    /** Ordered steps. An empty list renders the content without navigation chrome. */
    steps: { id: string; label: string }[];
    /** 0-based index of the current step, clamped to the available steps. */
    activeIndex: number;
    /** Whether "Suivant"/"Terminer" is enabled for the current step. */
    canAdvance?: boolean;
    onBack: () => void;
    onNext: () => void;
    onFinish: () => void;
    /** Jump back to an already-completed step (clicking a done row). */
    onJump: (index: number) => void;
    /** Replaces "Précédent" in the footer's left slot for the current step
     * (e.g. the last step's "Vers l'import"). */
    additionalAction?: { label: string; onClick: () => void };
    /** Fills its container: a step rail on desktop, one tab per step and
     * swipeable steps on a phone, the footer pinned to the bottom. */
    fullscreen?: boolean;
    /** A short line beside the footer's buttons (fullscreen only). */
    hint?: string | Snippet;
    /** Replaces "Suivant"/"Terminer" on the current step (fullscreen only). */
    nextLabel?: string;
    /** Above the desktop step rail (fullscreen only). */
    asideHeader?: Snippet;
    /** Below the desktop step rail (fullscreen only). */
    aside?: Snippet;
    /** Top-right corner, e.g. a close button (fullscreen only). */
    topAction?: Snippet;
    class?: string;
    /** The current step's own markup — the wizard only owns nav/progress chrome. */
    children: Snippet;
  } = $props();

  const currentIndex = $derived(
    normalizeWizardIndex(steps.length, activeIndex),
  );
  const isLast = $derived(
    currentIndex !== null && currentIndex === steps.length - 1,
  );
  const showBack = $derived(currentIndex !== null && currentIndex > 0);

  const reduced = prefersReducedMotion();

  // Which way the last step change went (1 = forward, -1 = back), so the
  // outgoing step slides out the way the user is leaving and the new one
  // comes in from the other side. Runs before the `{#key}` below re-renders;
  // the transition params are read when the transition starts.
  let direction = $state<1 | -1>(1);
  let previousIndex: number | null = null;
  $effect.pre(() => {
    const index = currentIndex;
    if (previousIndex !== null && index !== null && index !== previousIndex)
      direction = index > previousIndex ? 1 : -1;
    previousIndex = index;
  });

  const stepIn = (node: Element, dir: 1 | -1) =>
    fly(node, {
      x: dir * 24,
      duration: reduced ? 0 : 240,
      delay: reduced ? 0 : 80,
      easing: cubicOut,
    });
  const stepOut = (node: Element, dir: 1 | -1) =>
    fly(node, {
      x: dir * -24,
      duration: reduced ? 0 : 140,
      easing: cubicOut,
    });

  // Desktop step list: one highlight that glides to the current row instead
  // of each row snapping its own background on and off. Re-measured when the
  // nav resizes (a label wrapping, the md breakpoint showing it).
  let nav = $state<HTMLElement>();
  const rows = $state<HTMLButtonElement[]>([]);
  let highlight = $state<{ top: number; height: number } | null>(null);

  $effect(() => {
    if (!nav || currentIndex === null) return;
    const index = currentIndex;
    const measure = () => {
      const row = rows[index];
      if (!row || row.offsetHeight === 0) return;
      highlight = { top: row.offsetTop, height: row.offsetHeight };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  });

  const pad = (n: number) => String(n).padStart(2, "0");

  function advance() {
    if (!canAdvance) return;
    if (isLast) onFinish();
    else onNext();
  }

  // Fullscreen: a horizontal swipe on a phone, the arrow keys on a keyboard.
  // The last step only moves back, so finishing stays a deliberate tap.
  let swipeStart: { x: number; y: number } | null = null;

  function onPointerDown(event: PointerEvent) {
    swipeStart =
      event.pointerType === "touch"
        ? { x: event.clientX, y: event.clientY }
        : null;
  }

  function onPointerUp(event: PointerEvent) {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0 && showBack) onBack();
    else if (dx < 0 && !isLast && canAdvance) onNext();
  }

  function onKeydown(event: KeyboardEvent) {
    if (!fullscreen || currentIndex === null || event.defaultPrevented) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("input, textarea, select, [contenteditable]")
    )
      return;
    if (event.key === "ArrowLeft" && showBack) onBack();
    else if (event.key === "ArrowRight" && !isLast && canAdvance) onNext();
  }

  let scroller = $state<HTMLElement>();
  $effect(() => {
    void currentIndex;
    scroller?.scrollTo({ top: 0 });
  });
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet dot()}
  <span
    class="border-border bg-bg pointer-events-none absolute top-0 left-48 hidden h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border md:block"
    aria-hidden="true"></span>
{/snippet}

{#snippet stepRow(index: number)}
  {@const step = steps[index]}
  {@const done = currentIndex !== null && index < currentIndex}
  {@const current = index === currentIndex}
  <button
    bind:this={rows[index]}
    type="button"
    aria-current={current ? "step" : undefined}
    class="relative flex w-full items-baseline gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-200 disabled:cursor-default {current
      ? 'text-fg'
      : done
        ? 'text-dim hover:bg-surface-2'
        : 'text-dim/50'}"
    disabled={!done}
    onclick={() => done && onJump(index)}>
    <span
      class="timecode w-5 shrink-0 text-xs transition-colors duration-200 {current
        ? 'text-accent'
        : ''}">
      {#if done}
        <span
          class="inline-flex"
          in:scale={{ start: 0.95, duration: reduced ? 0 : 200 }}>
          <Icon name="check" class="text-accent h-3.5 w-3.5" />
        </span>
      {:else}
        {String(index + 1).padStart(2, "0")}
      {/if}
    </span>
    <span class="text-sm font-semibold">{step.label}</span>
  </button>
{/snippet}

<div class={fullscreen ? `flex h-full min-h-0 ${cls}` : `relative ${cls}`}>
  {#if currentIndex === null}
    <div class="min-w-0 p-5 md:p-6">
      {@render children()}
    </div>
  {:else if fullscreen}
    <aside
      class="border-border hidden w-72 shrink-0 flex-col border-r border-dashed px-6 pt-8 pb-7 md:flex">
      {@render asideHeader?.()}
      <nav bind:this={nav} class="relative flex flex-col gap-0.5">
        {#if highlight}
          <div
            class="bg-accent/10 pointer-events-none absolute inset-x-0 top-0 rounded-lg transition-[translate,height] duration-250 ease-out motion-reduce:transition-none"
            style:translate={`0 ${highlight.top}px`}
            style:height={`${highlight.height}px`}
            aria-hidden="true">
            <span
              class="bg-accent absolute top-1/2 -left-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]"
            ></span>
          </div>
        {/if}
        {#each steps as _step, i (steps[i].id)}
          {@render stepRow(i)}
        {/each}
      </nav>
      {#if aside}
        <div class="mt-auto">{@render aside()}</div>
      {/if}
    </aside>

    <div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div class="shrink-0 pt-[env(safe-area-inset-top)] md:hidden">
        <div class="flex h-14 items-center gap-2.5 pr-5 pl-1.5">
          <button
            type="button"
            class="btn-icon h-11 w-11 shrink-0 rounded-full transition-opacity duration-200 {showBack
              ? ''
              : 'pointer-events-none opacity-0'}"
            aria-label={m.common_previous()}
            tabindex={showBack ? undefined : -1}
            onclick={onBack}>
            <Icon name="chevron-left" class="h-5 w-5" />
          </button>
          <div
            class="flex flex-1 gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={currentIndex + 1}
            aria-label={m.wizard_step_progress({
              current: currentIndex + 1,
              total: steps.length,
              label: steps[currentIndex].label,
            })}>
            {#each steps as step, i (step.id)}
              <span
                class="bg-surface-2 relative h-1.5 flex-1 overflow-hidden rounded-full">
                <span
                  class="bg-accent absolute inset-0 origin-left rounded-full transition-[scale,opacity] duration-300 ease-out motion-reduce:transition-none"
                  style:scale={i <= currentIndex ? "1 1" : "0 1"}
                  style:opacity={i < currentIndex ? 0.55 : 1}></span>
              </span>
            {/each}
          </div>
          <span class="timecode text-xs" aria-hidden="true">
            {pad(currentIndex + 1)} / {pad(steps.length)}
          </span>
          {@render topAction?.()}
        </div>
      </div>
      {#if topAction}
        <div class="absolute top-5 right-6 z-10 hidden md:block">
          {@render topAction()}
        </div>
      {/if}

      <div
        bind:this={scroller}
        role="presentation"
        class="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto"
        onpointerdown={onPointerDown}
        onpointerup={onPointerUp}
        onpointercancel={() => (swipeStart = null)}>
        <div class="grid px-5 pt-3 pb-6 md:px-16 md:pt-14 md:pb-8">
          {#key currentIndex}
            <div
              class="min-w-0 [grid-area:1/1]"
              in:stepIn={direction}
              out:stepOut={direction}>
              {@render children()}
            </div>
          {/key}
        </div>
      </div>

      <div
        class="flex shrink-0 flex-col gap-1 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
        <button
          type="button"
          class="btn btn-primary h-13 w-full {isLast
            ? 'btn-primary-cartouche'
            : ''}"
          disabled={!canAdvance}
          onclick={advance}>
          {nextLabel ?? (isLast ? m.common_finish() : m.common_next())}
        </button>
        {#if additionalAction}
          <button
            type="button"
            class="link-accent h-10 text-sm font-semibold"
            onclick={additionalAction.onClick}>
            {additionalAction.label}
          </button>
        {:else}
          <p class="text-dim grid h-10 place-items-center text-center text-xs">
            {#if typeof hint === "function"}{@render hint()}{:else}{hint ??
                ""}{/if}
          </p>
        {/if}
      </div>

      <div
        class="border-border relative hidden h-21 shrink-0 items-center gap-4 border-t border-dashed px-16 md:flex">
        <button
          type="button"
          class="btn btn-ghost transition-opacity duration-200 {showBack
            ? ''
            : 'pointer-events-none opacity-0'}"
          tabindex={showBack ? undefined : -1}
          onclick={onBack}>
          {m.common_previous()}
        </button>
        <p class="text-dim ml-auto text-sm">
          {#if typeof hint === "function"}{@render hint()}{:else}{hint ??
              ""}{/if}
        </p>
        {#if additionalAction}
          <button
            type="button"
            class="btn btn-ghost"
            onclick={additionalAction.onClick}>
            {additionalAction.label}
          </button>
        {/if}
        <button
          type="button"
          class="btn btn-primary {isLast ? 'btn-primary-cartouche' : ''}"
          disabled={!canAdvance}
          onclick={advance}>
          {nextLabel ?? (isLast ? m.common_finish() : m.common_next())}
        </button>
      </div>
    </div>
  {:else}
    <div class="md:flex">
      <!-- Desktop: vertical step list, dashed hairline divider before the content
         (Séance's letterbox-rule idiom, dashed/dotted here as a "ticket stub"
         perforation rather than a solid rule). -->
      <nav
        bind:this={nav}
        class="border-border relative hidden shrink-0 flex-col gap-0.5 border-r border-dashed p-3 md:flex md:w-48">
        {#if highlight}
          <div
            class="bg-accent/10 pointer-events-none absolute inset-x-3 top-0 rounded-lg transition-[translate,height] duration-250 ease-out motion-reduce:transition-none"
            style:translate={`0 ${highlight.top}px`}
            style:height={`${highlight.height}px`}
            aria-hidden="true">
            <span
              class="bg-accent absolute top-1/2 -left-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]"
            ></span>
          </div>
        {/if}
        {#each steps as _step, i (steps[i].id)}
          {@render stepRow(i)}
        {/each}
      </nav>

      <!-- Mobile: compact progress bar, with a separator before the step
         content (borrowed from the filmstrip direction, kept alongside the
         ticket-stub look everywhere else). -->
      <div class="border-border border-b p-4 md:hidden">
        <ProgressBar
          value={((currentIndex + 1) / steps.length) * 100}
          label={m.wizard_step_progress({
            current: currentIndex + 1,
            total: steps.length,
            label: steps[currentIndex].label,
          })}
          height="h-1"
          class="mb-2" />
        <p class="timecode grid text-xs">
          {#key currentIndex}
            <span
              class="[grid-area:1/1]"
              in:fade={{ duration: reduced ? 0 : 180, delay: reduced ? 0 : 60 }}
              out:fade={{ duration: reduced ? 0 : 100 }}>
              {m.wizard_step_progress({
                current: currentIndex + 1,
                total: steps.length,
                label: steps[currentIndex].label,
              })}
            </span>
          {/key}
        </p>
      </div>

      <!-- Each step slides in from the side the user is heading to while the
         previous one leaves the other way; AnimatedHeight eases the panel
         between their heights. -->
      <div class="min-w-0 flex-1 p-5 md:p-6">
        <AnimatedHeight>
          {#key currentIndex}
            <div
              class="min-w-0 [grid-area:1/1]"
              in:stepIn={direction}
              out:stepOut={direction}>
              {@render children()}
            </div>
          {/key}
        </AnimatedHeight>
      </div>
    </div>

    <div class="relative flex items-center justify-between gap-3 pt-4 md:px-6">
      <!-- The line itself bleeds past this row's own box to reach the modal's
         true edges (it sits inside Modal's `p-5`); the row's own padding
         stays untouched so the buttons don't move. -->
      <div
        class="border-border pointer-events-none absolute -inset-x-5 top-0 border-t border-dashed"
        aria-hidden="true">
      </div>
      {@render dot()}

      {#if showBack}
        <button type="button" class="btn btn-ghost" onclick={onBack}>
          {m.common_previous()}
        </button>
      {:else}
        <div></div>
      {/if}
      <div class="flex gap-4">
        {#if additionalAction}
          <button
            type="button"
            class="btn btn-ghost"
            onclick={additionalAction.onClick}>
            {additionalAction.label}
          </button>
        {/if}
        <button
          type="button"
          class="btn btn-primary {isLast ? 'btn-primary-cartouche' : ''}"
          disabled={!canAdvance}
          onclick={isLast ? onFinish : onNext}>
          {isLast ? m.common_finish() : m.common_next()}
        </button>
      </div>
    </div>
  {/if}
</div>
