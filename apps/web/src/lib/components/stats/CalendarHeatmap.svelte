<script lang="ts">
  // GitHub-style calendar heatmap: 7 rows (weekdays) × N columns (weeks).
  // Days are pre-zero-filled by the caller, oldest first, chronological.
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages";

  let {
    days,
    legend = true,
    compact = false,
  }: {
    days: { date: string; count: number }[];
    /** Set false for compact/teaser placements (e.g. the profile mini-heatmap). */
    legend?: boolean;
    /** Smaller cells (9px vs 12px) for a teaser placement. */
    compact?: boolean;
  } = $props();

  const max = $derived(Math.max(1, ...days.map((d) => d.count)));

  // Pad the front so the first column starts on a Sunday, matching the
  // 7-row grid — padding cells render empty (no date, no count).
  const weeks = $derived.by(() => {
    if (days.length === 0) return [];
    const firstWeekday = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
    const padded: ({ date: string; count: number } | null)[] = [
      ...Array<null>(firstWeekday).fill(null),
      ...days,
    ];
    const cols: ({ date: string; count: number } | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      cols.push(padded.slice(i, i + 7));
    }
    return cols;
  });

  function level(count: number): number {
    if (count === 0) return 0;
    const ratio = count / max;
    if (ratio > 0.66) return 3;
    if (ratio > 0.33) return 2;
    return 1;
  }

  const LEVEL_BG = [
    "var(--surface-2)",
    "color-mix(in srgb, var(--accent) 30%, var(--surface))",
    "color-mix(in srgb, var(--accent) 60%, var(--surface))",
    "var(--accent)",
  ];

  const DATESTYLE_MEDIUM_OPTIONS: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
  };
  const cellClass = $derived(compact ? "h-[9px] w-[9px]" : "h-3 w-3");
  const gapClass = $derived(compact ? "gap-[2.5px]" : "gap-[3px]");
</script>

<div
  class="grid auto-cols-min grid-flow-col {gapClass} overflow-x-auto pb-1"
  role="img"
  aria-label="Heatmap d'activité">
  {#each weeks as week, wi (wi)}
    <div class="grid grid-rows-7 {gapClass}">
      {#each week as day, di (di)}
        {#if day}
          <div
            class="{cellClass} rounded-sm"
            style="background:{LEVEL_BG[level(day.count)]}"
            title="{formatDate(
              `${day.date}T00:00:00Z`,
              DATESTYLE_MEDIUM_OPTIONS,
            )} — {day.count}">
          </div>
        {:else}
          <div class={cellClass}></div>
        {/if}
      {/each}
    </div>
  {/each}
</div>
{#if legend}
  <div class="text-dim mt-3 flex items-center gap-1.5 text-[11px]">
    <span>{m.common_less()}</span>
    {#each LEVEL_BG as bg, i (i)}
      <span class="h-3 w-3 rounded-sm" style="background:{bg}"></span>
    {/each}
    <span>{m.common_more()}</span>
  </div>
{/if}
