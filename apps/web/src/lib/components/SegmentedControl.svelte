<script lang="ts" generics="T extends string">
  import PremiumLockBadge from "./PremiumLockBadge.svelte";
  import Tooltip from "./Tooltip.svelte";
  import { m } from "$lib/paraglide/messages.js";

  interface SegmentOption<V extends string> {
    value: V;
    label: string;
    disabled?: boolean;
    /** Native title shown on hover — ignored when `locked` (uses Tooltip instead). */
    disabledReason?: string;
    /** Premium-gated option: shows the lock badge + Tooltip instead of a native title. */
    locked?: boolean;
  }

  let {
    options,
    value,
    onChange,
    class: className = "",
  }: {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    class?: string;
  } = $props();
</script>

{#snippet segment(opt: SegmentOption<T>)}
  {@const on = value === opt.value}
  <button
    type="button"
    class="rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40"
    class:bg-accent={on}
    class:text-accent-fg={on}
    class:text-dim={!on}
    class:hover:text-fg={!on}
    disabled={opt.disabled || opt.locked}
    title={opt.locked ? undefined : opt.disabledReason}
    onclick={() => onChange(opt.value)}>
    {opt.label}
  </button>
{/snippet}

<div
  class="border-border bg-surface-2 inline-flex shrink-0 gap-0.5 rounded-full border p-0.5 {className}">
  {#each options as opt (opt.value)}
    {#if opt.locked}
      <Tooltip text={m.common_premium_locked()}>
        {@render segment(opt)}
        <PremiumLockBadge />
      </Tooltip>
    {:else}
      {@render segment(opt)}
    {/if}
  {/each}
</div>
