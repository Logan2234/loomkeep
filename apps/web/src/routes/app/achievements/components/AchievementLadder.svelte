<script lang="ts">
  // The tier ladder plus its context note — the "deepening" half of a card.
  // Shared verbatim by the desktop unfold panel and the mobile drawer, so
  // the two can never drift apart.
  import { equipAchievement, unequipAchievement } from "$lib/api/gamification";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { formatNumber } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import {
    MAX_EQUIPPED_BADGES,
    type AchievementDto,
    type AchievementTier,
  } from "@loomkeep/shared";
  import type { AchievementGroup } from "../achievements";
  import { contextNote, tierLabel } from "../labels";

  let {
    group,
    equippedCount,
  }: { group: AchievementGroup; equippedCount: number } = $props();

  const note = $derived(contextNote(group));

  const FILL: Record<AchievementTier, string> = {
    bronze: "border-tier-bronze bg-tier-bronze",
    silver: "border-tier-silver bg-tier-silver",
    gold: "border-tier-gold bg-tier-gold",
  };

  const equipMut = createApiMutation<string, string[]>(() => ({
    mutate: (key) => equipAchievement(key),
    invalidates: [keys.gamification.achievements()],
    errorToast: true,
  }));
  const unequipMut = createApiMutation<string, string[]>(() => ({
    mutate: (key) => unequipAchievement(key),
    invalidates: [keys.gamification.achievements()],
    errorToast: true,
  }));

  function toggle(entry: AchievementDto) {
    if (!entry.key) return;
    if (entry.equipped) unequipMut.mutate(entry.key);
    else equipMut.mutate(entry.key);
  }

  function busy(key: string | null) {
    return (
      (equipMut.loading && equipMut.variables === key) ||
      (unequipMut.loading && unequipMut.variables === key)
    );
  }
</script>

<div class="flex flex-col">
  {#each group.entries as entry, index (entry.key ?? index)}
    {@const current = entry === group.next}
    {@const canEquip = entry.unlocked && !entry.secret}
    {@const atLimit = !entry.equipped && equippedCount >= MAX_EQUIPPED_BADGES}
    <div
      class="border-border grid grid-cols-[0.875rem_1fr_auto_auto_auto] items-center gap-2 border-b py-1.5 last:border-b-0">
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
      {#if canEquip}
        <button
          type="button"
          class="text-dim hover:text-fg disabled:pointer-events-none disabled:opacity-30 {entry.equipped
            ? 'text-accent hover:text-accent'
            : ''}"
          disabled={busy(entry.key) || (!entry.equipped && atLimit)}
          title={entry.equipped
            ? m.gamification_unequip_badge()
            : atLimit
              ? m.gamification_badge_limit_reached()
              : m.gamification_equip_badge()}
          aria-label={entry.equipped
            ? m.gamification_unequip_badge()
            : m.gamification_equip_badge()}
          onclick={() => toggle(entry)}>
          <Icon name={entry.equipped ? "pin-filled" : "pin"} class="h-3 w-3" />
        </button>
      {:else}
        <span></span>
      {/if}
    </div>
  {/each}
</div>

{#if note.length > 0}
  <p class="border-border text-dim mt-2 border-t pt-2 text-xs">
    <!-- Dim sentence, bright values: the date and the count are what the note
       is actually there to say. -->
    {#each note as segment, index (index)}{#if segment.strong}<b
          class="text-fg font-semibold">{segment.text}</b
        >{:else}{segment.text}{/if}{/each}
  </p>
{/if}
