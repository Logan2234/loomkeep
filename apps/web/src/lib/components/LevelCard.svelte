<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import { levelProgress, xpForLevel } from "@loomkeep/shared";

  // "Reel" design ("bobine qui se charge" — validated in the "Trois séances"
  // artifact): 10 fixed cells, one lights up proportionally as the current
  // level fills up. xpForCurrentLevel is the total cost of the level the
  // user is currently in (xpForLevel(level+1) - xpForLevel(level)), used
  // both for the "x / y XP" line and for sizing the cells.
  let { xp }: { xp: number } = $props();

  const progress = $derived(levelProgress(xp));
  const xpForCurrentLevel = $derived(
    xpForLevel(progress.level + 1) - xpForLevel(progress.level),
  );
  const pctInLevel = $derived(
    xpForCurrentLevel > 0 ? progress.xpInLevel / xpForCurrentLevel : 0,
  );

  const CELL_COUNT = 10;

  // filled: cells entirely lit. current: the one cell mid-fill (its
  // --fill-pct), skipped when pctInLevel lands exactly on a cell boundary —
  // that cell is then fully filled instead, not a 0%/100% "current" cell.
  const filledExact = $derived(pctInLevel * CELL_COUNT);
  const filled = $derived(Math.floor(filledExact));
  const onBoundary = $derived(Number.isInteger(filledExact));
  type CellState = "filled" | "current" | "empty";
  const cells = $derived(
    Array.from({ length: CELL_COUNT }, (_, i): CellState => {
      if (i < filled || (onBoundary && i === filled - 1)) return "filled";
      if (i === filled && !onBoundary) return "current";
      return "empty";
    }),
  );
  const currentFillPct = $derived(
    onBoundary ? 0 : (filledExact - filled) * 100,
  );

  const CELL_BASE =
    "h-3.5 flex-1 rounded-[3px] border transition-[background,border-color] motion-reduce:transition-none";
  const CELL_CLASS: Record<"filled" | "current" | "empty", string> = {
    empty: `${CELL_BASE} border-border bg-surface-2`,
    current: `${CELL_BASE} border-accent`,
    filled: `${CELL_BASE} border-accent bg-accent shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_55%,transparent)]`,
  };
</script>

<div
  class="border-border bg-surface rounded-2xl border px-6 py-[22px] shadow-[0_1px_2px_rgba(28,23,18,.06),0_8px_24px_rgba(28,23,18,.05)] dark:shadow-[0_1px_2px_rgba(0,0,0,.4),0_12px_32px_rgba(0,0,0,.35)]">
  <div
    class="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
    <p class="font-display text-[26px] font-extrabold">
      {m.common_level()} <span class="text-accent">{progress.level}</span>
    </p>
    <p class="text-dim font-mono text-[12.5px]">
      {m.profile_level_progress({
        xpInLevel: progress.xpInLevel,
        xpForLevel: xpForCurrentLevel,
        xpToNext: progress.xpToNext,
      })}
    </p>
  </div>
  <div class="flex gap-1">
    {#each cells as cell, i (i)}
      <div
        class={CELL_CLASS[cell]}
        style={cell === "current"
          ? `background: linear-gradient(90deg, var(--accent) ${currentFillPct}%, var(--surface-2) ${currentFillPct}%)`
          : undefined}>
      </div>
    {/each}
  </div>
</div>
