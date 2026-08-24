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

  function barHeight(b: { value: number }): number {
    return mounted ? Math.round((b.value / max) * 104) : 0;
  }

  // Starts empty and grows to real heights a frame after mount, rather than
  // appearing already at full height — each bar's own `transition:` then
  // animates later changes (a different rating filter, say) too.
  let mounted = $state(false);
  $effect(() => {
    // Double rAF: a single one can race the element's very first paint, so
    // the "0" starting height never actually gets painted before it jumps to
    // the target — the second frame guarantees that first paint happens.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => (mounted = true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  });
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
          class="bg-accent w-full rounded-t transition-[filter,height] duration-300 ease-out group-hover:brightness-110"
          style="height:{barHeight(b)}px">
        </div>
        <span class="timecode text-[11px]">{b.label}</span>
      </button>
    {:else}
      <div
        class="flex flex-1 flex-col items-center gap-1.5"
        title="{b.label} — {b.value}">
        <div
          class="bg-accent w-full rounded-t transition-[height] duration-300 ease-out"
          style="height:{barHeight(b)}px">
        </div>
        <span class="timecode text-[11px]">{b.label}</span>
      </div>
    {/if}
  {/each}
</div>
