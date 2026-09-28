<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import { formatSessionMinutes } from "$lib/session-presentation";
  import { MAX_SESSION_DURATION_MINUTES } from "@loomkeep/shared";
  import AnimatedNumberInput from "./AnimatedNumberInput.svelte";
  import Icon from "./Icon.svelte";

  let {
    value = $bindable(),
    quickDurations,
    disabled = false,
    variant = "accent",
  }: {
    value: number;
    quickDurations: readonly number[];
    disabled?: boolean;
    variant?: "accent" | "neutral";
  } = $props();

  function adjust(delta: number) {
    const current = Number.isFinite(Number(value)) ? Number(value) : 1;
    value = Math.min(
      MAX_SESSION_DURATION_MINUTES,
      Math.max(1, current + delta),
    );
  }
</script>

<div
  class="rounded-2xl border p-4 sm:p-5 {variant === 'accent'
    ? 'border-accent/35 from-accent/14 to-accent/3 bg-linear-to-br'
    : 'border-border bg-surface-2'}">
  <div
    class="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-3">
    <button
      type="button"
      class="btn-icon border-border bg-bg h-11 w-11 border"
      aria-label={m.session_duration_decrease()}
      {disabled}
      onclick={() => adjust(-15)}>
      <Icon name="minus" class="h-4 w-4" />
    </button>

    <div class="min-w-0 text-center">
      <span
        class="timecode text-dim block text-[0.62rem] tracking-[0.16em] uppercase">
        {m.session_duration()}
      </span>
      <span class="mt-1 flex items-baseline justify-center gap-2">
        <AnimatedNumberInput
          bind:value
          label={m.session_duration()}
          min={1}
          max={MAX_SESSION_DURATION_MINUTES}
          {disabled}
          class="h-16 w-32"
          numberClass="text-5xl" />
        <span class="text-dim text-sm font-bold"
          >{m.session_minutes_short()}</span>
      </span>
      {#if value >= 60}
        <span
          role="status"
          class="text-accent mt-1 block text-xs font-bold tabular-nums">
          {formatSessionMinutes(value)}
        </span>
      {/if}
    </div>

    <button
      type="button"
      class="btn-icon border-border bg-bg h-11 w-11 border"
      aria-label={m.session_duration_increase()}
      {disabled}
      onclick={() => adjust(15)}>
      <Icon name="plus" class="h-4 w-4" />
    </button>
  </div>

  <div class="mt-4 grid grid-cols-4 gap-1.5" aria-label={m.session_duration()}>
    {#each quickDurations as minutes (minutes)}
      <button
        type="button"
        class="rounded-xl border px-2 py-2 text-xs font-bold transition-colors {value ===
        minutes
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-border bg-bg/70 text-dim hover:text-fg'}"
        aria-pressed={value === minutes}
        {disabled}
        onclick={() => (value = minutes)}>
        {formatSessionMinutes(minutes)}
      </button>
    {/each}
  </div>
</div>
