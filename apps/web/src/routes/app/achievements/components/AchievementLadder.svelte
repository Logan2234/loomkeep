<script lang="ts">
  import { equipAchievement, unequipAchievement } from "$lib/api/gamification";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { formatNumber } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import {
    MAX_EQUIPPED_BADGES,
    type AchievementDto,
    type AchievementTier,
  } from "@loomkeep/shared";
  import type { AchievementGroup } from "../achievements";
  import {
    contextNote,
    rarityLabel,
    rarityPercent,
    tierLabel,
  } from "../labels";

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

<!-- One grid, rows as subgrids: every column lines up from one tier to the
     next, however wide its figures ("45 %" vs "< 8 %", "50 XP" vs "400 XP").
     The wider gap keeps share, reward and pin apart as three separate reads. -->
<div class="grid grid-cols-[1fr_auto_auto_auto] gap-x-4">
  {#each group.entries as entry, index (entry.key ?? index)}
    {@const current = entry === group.next}
    {@const canEquip = entry.unlocked && !entry.secret}
    {@const atLimit = !entry.equipped && equippedCount >= MAX_EQUIPPED_BADGES}
    <div
      class="border-border col-span-full grid grid-cols-subgrid items-center border-b py-1.5 last:border-b-0">
      <!-- The goal stands for the tier: its colour is already the pip's, and
           "Bronze · 25" said the same thing twice. The name stays for screen
           readers, which get no colour. -->
      <span class="flex items-center gap-2">
        <i
          class="block h-1 w-3.5 shrink-0 rounded-full border {entry.unlocked
            ? FILL[entry.tier ?? 'gold']
            : 'border-border bg-surface-2'}">
        </i>
        <span class="sr-only">{tierLabel(entry.tier)}</span>
        <span
          class="timecode text-xs {current
            ? 'text-accent'
            : entry.unlocked
              ? 'text-fg'
              : ''}">
          {entry.progress
            ? formatNumber(entry.progress.target)
            : m.gamification_tier_single()}
        </span>
      </span>
      {#if entry.rarity}
        {@const sentence = rarityLabel(entry.rarity)}
        <span
          class="timecode inline-flex items-center justify-end gap-1 text-xs"
          title={sentence}>
          <Icon name="users" class="h-3 w-3 shrink-0" />
          <span aria-hidden="true">{rarityPercent(entry.rarity)}</span>
          <span class="sr-only">{sentence}</span>
        </span>
      {:else}
        <span></span>
      {/if}
      <span
        class="timecode text-right text-xs {entry.unlocked
          ? 'text-accent'
          : ''}">
        {entry.xpAward === null
          ? m.gamification_secret_locked_name()
          : m.gamification_xp_award({ xp: formatNumber(entry.xpAward) })}
      </span>
      {#if canEquip}
        {@const label = entry.equipped
          ? m.gamification_unequip_badge()
          : m.gamification_equip_badge()}
        {@const blocked = !entry.equipped && atLimit}
        {#if blocked}
          <Tooltip text={m.gamification_badge_limit_reached()}>
            <button type="button" class="equip-btn" disabled aria-label={label}>
              <Icon name="pin" class="h-3 w-3" />
            </button>
          </Tooltip>
        {:else}
          <button
            type="button"
            class="equip-btn {entry.equipped ? 'equip-btn-on' : ''} {busy(
              entry.key,
            )
              ? 'animate-pulse'
              : ''}"
            disabled={busy(entry.key)}
            title={label}
            aria-label={label}
            onclick={() => toggle(entry)}>
            <Icon
              name={entry.equipped ? "pin-filled" : "pin"}
              class="h-3 w-3" />
          </button>
        {/if}
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

<style>
  .equip-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1.25rem;
    width: 1.25rem;
    border-radius: 999px;
    color: var(--dim);
    transition:
      background-color 150ms ease,
      color 150ms ease,
      transform 100ms ease;
  }

  .equip-btn:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--fg);
    transform: scale(1.05);
  }

  .equip-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .equip-btn:disabled {
    opacity: 0.35;
  }

  .equip-btn-on {
    background: var(--accent);
    color: var(--accent-fg);
  }

  .equip-btn-on:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-fg);
    filter: brightness(1.1);
  }
</style>
