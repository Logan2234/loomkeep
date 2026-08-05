<script lang="ts">
  // Rule-and-caps section separator, shared by /stats and /admin/stats.
  // `class` carries the caller's own vertical rhythm (the admin page wraps
  // each section in a bordered block, /stats spaces them itself).
  let {
    label,
    badge,
    class: className = "",
  }: { label: string; badge?: string; class?: string } = $props();
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
  <span class="border-border flex-1 border-t" aria-hidden="true"></span>
</p>
