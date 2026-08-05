<script lang="ts">
  // Small inline indicator next to a pseudo — Snapchat-flame style. Renders
  // nothing when there's no streak (undefined/0), so callers can drop it in
  // unconditionally next to any displayName.
  let { days }: { days: number | undefined } = $props();
</script>

{#if days && days > 0}
  <span
    class="text-accent inline-flex items-center gap-0.5 align-middle text-xs font-bold"
    title="{days} prise{days > 1
      ? 's'
      : ''} d’affilée — jours de suite avec un épisode ou un film vu">
    <span aria-hidden="true">🎬</span>{days}
  </span>
{/if}
