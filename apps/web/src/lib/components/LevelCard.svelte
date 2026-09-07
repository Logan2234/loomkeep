<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import { levelProgress, xpForLevel } from "@loomkeep/shared";

  let {
    xp,
    leaderboardHref,
    achievementsHref,
  }: {
    xp: number;
    leaderboardHref?: string;
    achievementsHref?: string;
  } = $props();

  const progress = $derived(levelProgress(xp));
  const xpForCurrentLevel = $derived(
    xpForLevel(progress.level + 1) - xpForLevel(progress.level),
  );
  const pctInLevel = $derived(
    xpForCurrentLevel > 0 ? progress.xpInLevel / xpForCurrentLevel : 0,
  );

  const CELL_COUNT = 10;

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

  const CASCADE_STEP_MS = 45;
  let lit = $state(false);
  $effect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => (lit = true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  });

  const CELL_BASE =
    "h-3.5 flex-1 overflow-hidden rounded-[3px] border transition-[background,border-color] duration-300 motion-reduce:transition-none";
  const CELL_CLASS: Record<"filled" | "current" | "empty", string> = {
    empty: `${CELL_BASE} border-border bg-surface-2`,
    current: `${CELL_BASE} border-accent bg-surface-2`,
    filled: `${CELL_BASE} border-accent bg-accent shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_55%,transparent)]`,
  };
</script>

<div class="relative">
  {#if leaderboardHref && isFeatureNew("leaderboard")}
    <span class="absolute -top-2.5 -right-2"><NewBadge /></span>
  {/if}
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
        class={CELL_CLASS[lit ? cell : "empty"]}
        style="transition-delay: {i * CASCADE_STEP_MS}ms">
        {#if cell === "current"}
          <span
            class="bg-accent block h-full transition-[width] duration-200 motion-reduce:transition-none"
            style="width: {lit
              ? currentFillPct
              : 0}%; transition-delay: {(filled + 1) * CASCADE_STEP_MS}ms">
          </span>
        {/if}
      </div>
    {/each}
  </div>
  {#if leaderboardHref || achievementsHref}
    <div
      class="border-border mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3.5 text-sm">
      {#if achievementsHref}
        <a href={achievementsHref} class="btn-text relative">
          <Icon name="trophy" class="h-4 w-4" />
          {m.gamification_my_achievements()}
          {#if isFeatureNew("achievements")}
            <span
              class="bg-accent border-surface absolute -top-1 -right-2 h-2 w-2 rounded-full border-2"
              aria-hidden="true">
            </span>
          {/if}
        </a>
      {/if}
      {#if leaderboardHref}
        <a href={leaderboardHref} class="btn-text">
          <Icon name="crown" class="h-4 w-4" />
          {m.gamification_view_leaderboard()}
          <Icon name="chevron-right" class="h-3.5 w-3.5" />
        </a>
      {/if}
    </div>
  {/if}
</div>
