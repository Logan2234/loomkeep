<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
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
</script>

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
    type="button"
    class="relative flex w-full items-baseline gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors disabled:cursor-default {current
      ? 'text-fg bg-accent/10'
      : done
        ? 'text-dim hover:bg-surface-2'
        : 'text-dim/50'}"
    disabled={!done}
    onclick={() => done && onJump(index)}>
    {#if current}
      <span
        class="bg-accent absolute top-1/2 -left-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]"
        aria-hidden="true"></span>
    {/if}
    <span class="timecode w-5 shrink-0 text-xs {current ? 'text-accent' : ''}">
      {#if done}
        <Icon name="check" class="text-accent h-3.5 w-3.5" />
      {:else}
        {String(index + 1).padStart(2, "0")}
      {/if}
    </span>
    <span class="text-sm font-semibold">{step.label}</span>
  </button>
{/snippet}

<div class={`relative ${cls}`}>
  {#if currentIndex === null}
    <div class="min-w-0 p-5 md:p-6">
      {@render children()}
    </div>
  {:else}
    <div class="md:flex">
      <!-- Desktop: vertical step list, dashed hairline divider before the content
         (Séance's letterbox-rule idiom, dashed/dotted here as a "ticket stub"
         perforation rather than a solid rule). -->
      <nav
        class="border-border hidden shrink-0 flex-col gap-0.5 border-r border-dashed p-3 md:flex md:w-48">
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
        <p class="timecode text-xs">
          {m.wizard_step_progress({
            current: currentIndex + 1,
            total: steps.length,
            label: steps[currentIndex].label,
          })}
        </p>
      </div>

      <div class="min-w-0 flex-1 p-5 md:p-6">
        {@render children()}
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
