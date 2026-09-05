<script lang="ts">
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import { PERCENT_OPTIONS, formatNumber, formatRelative } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { AchievementTier } from "@loomkeep/shared";
  import type { CatalogueSummary } from "../achievements";
  import { achievementName, entryIcon } from "../labels";
  import AchievementMedallion from "$lib/components/AchievementMedallion.svelte";

  let { summary }: { summary: CatalogueSummary } = $props();

  const latest = $derived(summary.recent[0] ?? null);

  const STACK_RINGS: AchievementTier[] = ["gold", "silver", "bronze"];

  const reduced = prefersReducedMotion();
  let shown = $state(0);
  let counted = false;
  $effect(() => {
    const target = summary.unlocked;

    if (counted || reduced || target === 0) {
      shown = target;
      counted = true;
      return;
    }

    counted = true;
    const start = performance.now();
    let raf = requestAnimationFrame(function step(now: number) {
      const t = Math.min(1, (now - start) / 500);
      // Ease-out: fast off the mark, settling onto the final figure.
      shown = Math.round(target * (1 - (1 - t) ** 3));
      if (t < 1) raf = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(raf);
  });
</script>

<section
  class="achievements-hero card border-border flex flex-wrap items-center gap-x-8 gap-y-5 rounded-xl p-5">
  <div class="flex items-baseline gap-2">
    <span
      class="font-display text-fg text-4xl leading-none font-extrabold tabular-nums">
      {formatNumber(shown)}
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
