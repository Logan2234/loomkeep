<script lang="ts">
  // Mirrors the "Épisodes" block of a media detail page: a season <details>
  // with its progress rule, then one row per episode. Interactive on purpose —
  // marking an episode is the gesture the whole product is built around, so
  // the landing lets a visitor try it before signing up.
  import Icon from "$lib/components/Icon.svelte";
  import { SEVERANCE_S2 } from "./mock-data";

  let { onComplete }: { onComplete?: () => void } = $props();

  let counts = $state(SEVERANCE_S2.map((e) => e.watchCount));

  const total = SEVERANCE_S2.length;
  const watched = $derived(counts.filter((c) => c > 0).length);
  const pct = $derived(Math.round((watched / total) * 100));
  const seasonDone = $derived(watched === total);

  function toggle(i: number) {
    counts[i] = counts[i] > 0 ? 0 : 1;
    if (counts.filter((c) => c > 0).length === total) onComplete?.();
  }

  function code(n: number) {
    return `S02E${String(n).padStart(2, "0")}`;
  }
</script>

<div class="card">
  <div class="bg-surface-2 border-border border-b px-4 py-2.5">
    <div class="flex items-center gap-3">
      <Icon name="chevron-down" class="text-dim h-4 w-4 shrink-0" />
      <span class="font-display min-w-0 flex-1 truncate font-semibold">
        Saison 2
      </span>
      <span class="timecode shrink-0 text-xs">{watched} / {total}</span>
      {#if seasonDone}
        <span
          class="text-success inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
          <Icon name="check" class="h-4 w-4" /> Vue
        </span>
      {/if}
    </div>
    <div class="bg-border mt-2 h-[3px] w-full overflow-hidden rounded-full">
      <div class="bg-accent h-full transition-[width]" style={`width: ${pct}%`}>
      </div>
    </div>
  </div>

  <ul>
    {#each SEVERANCE_S2 as episode, i (episode.number)}
      <li class="border-border border-b last:border-b-0">
        <div class="flex items-center gap-3 px-4 py-2.5">
          <span class="timecode w-14 shrink-0 text-sm">
            {code(episode.number)}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm">
            {episode.title}
            {#if counts[i] > 1}
              <span class="text-success">×{counts[i]}</span>
            {/if}
          </span>
          {#if counts[i] > 0}
            <span
              class="text-success inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
              <Icon name="check" class="h-4 w-4" /> Vu
            </span>
            <button
              type="button"
              class="btn-icon"
              title="Annuler"
              aria-label="Annuler le visionnage de {code(episode.number)}"
              onclick={() => toggle(i)}>
              <Icon name="x" class="h-4 w-4" />
            </button>
          {:else}
            <button
              type="button"
              class="btn btn-primary btn-sm shrink-0"
              onclick={() => toggle(i)}>
              Marquer vu
            </button>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
</div>
