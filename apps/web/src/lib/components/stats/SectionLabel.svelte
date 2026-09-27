<script lang="ts">
  import NewBadge from "$lib/components/NewBadge.svelte";

  let {
    label,
    badge,
    isNew = false,
    class: className = "",
  }: {
    label: string;
    badge?: string;
    /** Shows a "Nouveau" pill — see feature-badges.ts. */
    isNew?: boolean;
    class?: string;
  } = $props();
</script>

<p
  class="text-dim mb-4 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.16em] uppercase {className}">
  {label}
  {#if badge}
    <span
      class="bg-surface-2 rounded px-1.5 py-0.5 tracking-normal normal-case">
      {badge}
    </span>
  {/if}
  {#if isNew}<NewBadge />{/if}
  <span class="border-border flex-1 border-t" aria-hidden="true"></span>
</p>
