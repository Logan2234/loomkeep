<script lang="ts">
  // One pip per tier the family has, filled for the ones earned — the "how
  // far along am I, and how far does this go" cue the card carries at rest.
  import { m } from "$lib/paraglide/messages.js";
  import type { AchievementDto, AchievementTier } from "@loomkeep/shared";

  let { entries }: { entries: AchievementDto[] } = $props();

  const FILL: Record<AchievementTier, string> = {
    bronze: "border-tier-bronze bg-tier-bronze",
    silver: "border-tier-silver bg-tier-silver",
    gold: "border-tier-gold bg-tier-gold",
  };

  const single = $derived(entries.length === 1);
  const earned = $derived(entries.filter((e) => e.unlocked).length);
</script>

<span
  class="flex items-center gap-1"
  title={m.gamification_pips_title({
    earned,
    total: entries.length,
  })}>
  {#each entries as entry, index (entry.key ?? index)}
    <i
      class="block h-1 rounded-full border {single
        ? 'w-5'
        : 'w-3.5'} {entry.unlocked
        ? FILL[entry.tier ?? 'gold']
        : 'border-border bg-surface-2'}">
    </i>
  {/each}
</span>
