<script lang="ts" generics="T extends string">
  import { m } from "$lib/paraglide/messages.js";
  import type { IconName } from "$lib/types/icon-name";
  import Icon from "./Icon.svelte";
  import PremiumLockBadge from "./PremiumLockBadge.svelte";
  import Tooltip from "./Tooltip.svelte";

  interface SegmentOption<V extends string> {
    value: V;
    label: string;
    icon?: IconName;
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
    label,
    class: className = "",
  }: {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    /** Accessible name for the group, when no visible label names it. */
    label?: string;
    class?: string;
  } = $props();
</script>

{#snippet segment(opt: SegmentOption<T>)}
  {@const on = value === opt.value}
  <button
    type="button"
    aria-pressed={on}
    class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.25 text-[0.82rem] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] disabled:pointer-events-none disabled:opacity-40"
    class:bg-surface={on}
    class:text-fg={on}
    class:shadow-sm={on}
    class:text-dim={!on}
    class:hover:text-fg={!on}
    disabled={opt.disabled || opt.locked}
    title={opt.locked ? undefined : opt.disabledReason}
    onclick={() => onChange(opt.value)}>
    {#if opt.icon}
      <Icon name={opt.icon} class="h-3.5 w-3.5" />
    {/if}
    {opt.label}
  </button>
{/snippet}

<div
  role="group"
  aria-label={label}
  class="border-border bg-surface-2 inline-flex shrink-0 gap-0.5 rounded-[9px] border p-0.75 {className}">
  {#each options as opt (opt.value)}
    {#if opt.locked}
      <Tooltip text={m.premium_locked()}>
        {@render segment(opt)}
        <PremiumLockBadge />
      </Tooltip>
    {:else}
      {@render segment(opt)}
    {/if}
  {/each}
</div>
