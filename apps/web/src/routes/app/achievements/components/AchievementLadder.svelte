<script lang="ts">
  // The tier ladder plus its context note — the "deepening" half of a card.
  // Shared verbatim by the desktop unfold panel and the mobile drawer, so
  // the two can never drift apart.
  import { formatNumber } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type { AchievementTier } from "@loomkeep/shared";
  import type { AchievementGroup } from "../achievements";
  import { contextNote, tierLabel } from "../labels";

  let { group }: { group: AchievementGroup } = $props();

  const FILL: Record<AchievementTier, string> = {
    bronze: "border-tier-bronze bg-tier-bronze",
    silver: "border-tier-silver bg-tier-silver",
    gold: "border-tier-gold bg-tier-gold",
  };
</script>

<div class="flex flex-col">
  {#each group.entries as entry, index (entry.key ?? index)}
    {@const current = entry === group.next}
    <div
      class="border-border grid grid-cols-[0.875rem_1fr_auto_auto] items-center gap-2 border-b py-1.5 last:border-b-0">
      <i
        class="block h-1 w-3.5 rounded-full border {entry.unlocked
          ? FILL[entry.tier ?? 'gold']
          : 'border-border bg-surface-2'}">
      </i>
      <span
        class="text-xs {entry.unlocked || current ? 'text-fg' : 'text-dim'}">
        {tierLabel(entry.tier)}
      </span>
      <span class="timecode text-xs {current ? 'text-accent' : ''}">
        {entry.progress ? formatNumber(entry.progress.target) : "1"}
      </span>
      <span class="timecode text-xs {entry.unlocked ? 'text-accent' : ''}">
        {entry.xpAward === null
          ? m.gamification_secret_locked_name()
          : m.gamification_xp_award({ xp: formatNumber(entry.xpAward) })}
      </span>
    </div>
  {/each}
</div>

<p class="border-border text-dim mt-2 border-t pt-2 text-xs">
  {contextNote(group)}
</p>
