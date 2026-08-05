<script lang="ts">
  // The row of headline numbers pinned above a page's content — on /admin/stats
  // the six the mockup called for, on the operational admin pages the two to
  // five that summarise the raw list underneath. Always assembled from the same
  // payload as what it sits above, so the strip can never disagree with it.
  let {
    tiles,
  }: {
    tiles: { value: string; unit?: string; label: string; alert?: boolean }[];
  } = $props();
</script>

<div class="my-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
  {#each tiles as tile (tile.label)}
    <div
      class="card px-4 py-3.5"
      class:border-danger={tile.alert}
      class:border-opacity-45={tile.alert}>
      <div
        class="font-display text-2xl leading-none font-extrabold tracking-tight tabular-nums"
        class:text-danger={tile.alert}>
        {tile.value}{#if tile.unit}<small class="text-dim text-xs font-bold">
            {tile.unit}
          </small>{/if}
      </div>
      <div
        class="text-dim mt-2 font-mono text-[10px] tracking-[0.08em] uppercase">
        {tile.label}
      </div>
    </div>
  {/each}
</div>
