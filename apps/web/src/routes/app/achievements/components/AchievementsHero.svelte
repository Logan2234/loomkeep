<script lang="ts">
  // The band above the grid: how much of the catalogue is done, what it has
  // paid out, and the three most recent unlocks as stacked medallions.
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import { PERCENT_OPTIONS, formatNumber, formatRelative } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type { CatalogueSummary } from "../achievements";
  import { achievementName, entryIcon } from "../labels";
  import AchievementMedallion from "./AchievementMedallion.svelte";

  let { summary }: { summary: CatalogueSummary } = $props();

  const latest = $derived(summary.recent[0] ?? null);
</script>

<section
  class="card border-border flex flex-wrap items-center gap-5 rounded-xl p-5">
  <div class="flex items-baseline gap-2">
    <span
      class="font-display text-fg text-4xl leading-none font-extrabold tabular-nums">
      {formatNumber(summary.unlocked)}
    </span>
    <span class="timecode text-sm">
      {m.gamification_hero_total({ total: formatNumber(summary.total) })}
    </span>
  </div>

  <div class="flex min-w-52 flex-1 flex-col gap-1.5">
    <div class="flex items-baseline justify-between gap-3">
      <span
        class="text-dim text-[0.65rem] font-semibold tracking-widest uppercase">
        {m.gamification_hero_progress_label()}
      </span>
      <span class="timecode text-accent text-xs">
        {m.gamification_hero_xp({ xp: formatNumber(summary.xpEarned) })}
      </span>
    </div>
    <ProgressBar value={summary.ratio * 100} height="h-1" rounded={false} />
    <div class="flex items-baseline justify-between gap-3">
      <span class="timecode text-xs">
        {m.gamification_hero_secrets({
          found: formatNumber(summary.secretsFound),
          total: formatNumber(summary.secretsTotal),
        })}
      </span>
      <span class="timecode text-xs">
        {formatNumber(summary.ratio, PERCENT_OPTIONS)}
      </span>
    </div>
  </div>

  <div class="flex items-center gap-3">
    <div class="flex">
      {#each summary.recent as entry, index (entry.key ?? index)}
        <span class={index > 0 ? "-ml-3.5" : ""}>
          <AchievementMedallion
            size="lg"
            tier={entry.tier ?? "gold"}
            icon={entryIcon(entry)} />
        </span>
      {/each}
    </div>
    <div class="flex flex-col">
      <span
        class="text-dim text-[0.6rem] font-semibold tracking-widest uppercase">
        {m.gamification_hero_recent()}
      </span>
      <span class="font-display text-fg text-sm font-bold">
        {#if latest?.unlockedAt}
          {achievementName(latest)} · {formatRelative(latest.unlockedAt)}
        {:else}
          {m.gamification_hero_recent_none()}
        {/if}
      </span>
    </div>
  </div>
</section>
