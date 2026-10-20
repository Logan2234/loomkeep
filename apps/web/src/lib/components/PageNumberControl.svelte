<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import AnimatedNumberInput from "./AnimatedNumberInput.svelte";
  import Icon from "./Icon.svelte";

  let {
    value = $bindable(),
    label,
    min,
    max,
    disabled = false,
    compact = false,
  }: {
    value: number;
    label: string;
    min: number;
    max?: number;
    disabled?: boolean;
    compact?: boolean;
  } = $props();

  function adjust(delta: number) {
    const current = Number.isFinite(Number(value)) ? Number(value) : min;
    value = Math.min(
      max ?? Number.POSITIVE_INFINITY,
      Math.max(min, current + delta),
    );
  }
</script>

<div class="min-w-0 text-center">
  <span
    class="timecode text-dim block text-[0.58rem] tracking-[0.12em] uppercase">
    {label}
  </span>
  <div class="mt-2 flex items-center justify-center gap-1.5 sm:gap-2">
    <button
      type="button"
      class="btn-icon border-border bg-bg/80 h-9 w-9 shrink-0 border"
      aria-label={m.session_value_decrease({ label })}
      disabled={disabled || value <= min}
      onclick={() => adjust(-1)}>
      <Icon name="minus" class="h-3.5 w-3.5" />
    </button>
    <AnimatedNumberInput
      bind:value
      {label}
      {min}
      {max}
      {disabled}
      class={compact ? "h-13 w-20" : "h-16 w-28"}
      numberClass={compact ? "text-3xl" : "text-4xl"} />
    <button
      type="button"
      class="btn-icon border-border bg-bg/80 h-9 w-9 shrink-0 border"
      aria-label={m.session_value_increase({ label })}
      disabled={disabled || value >= (max ?? Number.POSITIVE_INFINITY)}
      onclick={() => adjust(1)}>
      <Icon name="plus" class="h-3.5 w-3.5" />
    </button>
  </div>
</div>
