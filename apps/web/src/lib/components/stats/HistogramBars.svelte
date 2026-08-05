<script lang="ts">
  // Vertical bar histogram (ratings, decades…). Bars are clickable when
  // onSelect is passed — the caller decides what "select" means (open a
  // modal, navigate to a filtered list); this component only renders and
  // reports the click.
  let {
    bars,
    onSelect,
  }: {
    bars: { label: string; value: number }[];
    onSelect?: (label: string) => void;
  } = $props();

  const max = $derived(Math.max(1, ...bars.map((b) => b.value)));
</script>

<div class="flex h-32 items-end gap-1.5" role="img" aria-label="Histogramme">
  {#each bars as b (b.label)}
    {#if onSelect}
      <button
        type="button"
        class="group flex flex-1 flex-col items-center gap-1.5"
        title="{b.label} — {b.value}"
        onclick={() => onSelect(b.label)}>
        <div
          class="bg-accent w-full rounded-t transition-[filter] group-hover:brightness-110"
          style="height:{Math.round((b.value / max) * 104)}px">
        </div>
        <span class="timecode text-[11px]">{b.label}</span>
      </button>
    {:else}
      <div
        class="flex flex-1 flex-col items-center gap-1.5"
        title="{b.label} — {b.value}">
        <div
          class="bg-accent w-full rounded-t"
          style="height:{Math.round((b.value / max) * 104)}px">
        </div>
        <span class="timecode text-[11px]">{b.label}</span>
      </div>
    {/if}
  {/each}
</div>
