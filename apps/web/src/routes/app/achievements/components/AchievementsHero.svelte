<script lang="ts">
  // The band above the grid: how much of the catalogue is done, what it has
  // paid out, and the three most recent unlocks as stacked medallions.
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import { PERCENT_OPTIONS, formatNumber, formatRelative } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type { AchievementTier } from "@loomkeep/shared";
  import type { CatalogueSummary } from "../achievements";
  import { achievementName, entryIcon } from "../labels";
  import AchievementMedallion from "./AchievementMedallion.svelte";

  let { summary }: { summary: CatalogueSummary } = $props();

  const latest = $derived(summary.recent[0] ?? null);

  // The band's three medallions are a decorative descending set — gold to
  // bronze by position, not by the tier each unlock happens to carry. It
  // reads as a podium; per-unlock tiers are the grid's job.
  const STACK_RINGS: AchievementTier[] = ["gold", "silver", "bronze"];
</script>

<section
  class="achievements-hero card border-border flex flex-wrap items-center gap-x-8 gap-y-5 rounded-xl p-5">
  <div class="flex items-baseline gap-2">
    <span
      class="font-display text-fg text-4xl leading-none font-extrabold tabular-nums">
      {formatNumber(summary.unlocked)}
    </span>
    <span class="timecode text-sm">
      {m.gamification_hero_total({ total: formatNumber(summary.total) })}
    </span>
  </div>

  <div class="flex min-w-72 flex-1 flex-col gap-1.5">
    <div class="flex items-baseline justify-between gap-3">
      <span
        class="text-dim text-[0.65rem] font-semibold tracking-widest uppercase">
        {m.gamification_hero_progress_label()}
      </span>
      <span class="timecode text-accent text-xs">
        {m.gamification_hero_xp({ xp: formatNumber(summary.xpEarned) })}
      </span>
    </div>
    <ProgressBar
      value={summary.ratio * 100}
      height="h-1"
      track="bg-border"
      rounded={false} />
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
        <span class={index > 0 ? "-ml-4" : ""}>
          <AchievementMedallion
            size="lg"
            tier={STACK_RINGS[index] ?? "bronze"}
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

<style>
  .achievements-hero {
    background-image: radial-gradient(
      110% 160% at 8% 0%,
      color-mix(in srgb, var(--accent) 11%, transparent),
      transparent 62%
    );
  }
</style>
