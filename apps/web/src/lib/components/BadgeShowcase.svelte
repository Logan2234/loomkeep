<script lang="ts">
  // [G9] Up to MAX_EQUIPPED_BADGES equipped achievements on the profile, one
  // small self-contained box per badge — no wrapping card, no "Badges"
  // heading and no tier text (the medallion's ring already carries the
  // tier), so an empty list renders literally nothing (the ticket's
  // "zero-footprint when empty" requirement).
  import {
    achievementDescription,
    achievementName,
    entryIcon,
  } from "$lib/achievement-labels";
  import { tilt } from "$lib/actions/tilt";
  import type { AchievementDto } from "@loomkeep/shared";
  import AchievementMedallion from "./AchievementMedallion.svelte";
  import Tooltip from "./Tooltip.svelte";

  let { badges }: { badges: AchievementDto[] } = $props();
</script>

{#if badges.length > 0}
  <div class="flex gap-[0.6rem] select-none">
    {#each badges as badge (badge.key)}
      {@const tier = badge.tier ?? "gold"}
      <Tooltip text={achievementDescription(badge)} placement="bottom">
        <div
          use:tilt
          class="badge-box border-border bg-surface relative flex w-25 max-w-25 cursor-default flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transform-3d tier-{tier}">
          <span class="lift-med block translate-z-4">
            <AchievementMedallion icon={entryIcon(badge)} {tier} />
          </span>
          <span class="lift-name block translate-z-3 text-xs font-bold"
            >{achievementName(badge)}</span>
        </div>
      </Tooltip>
    {/each}
  </div>
{/if}

<style>
  .badge-box {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    transition:
      box-shadow 220ms ease,
      border-color 220ms ease;
  }

  .badge-box.tier-bronze:hover {
    border-color: var(--tier-bronze);
    box-shadow: 0 14px 28px -6px
      color-mix(in srgb, var(--tier-bronze) 55%, transparent);
  }
  .badge-box.tier-silver:hover {
    border-color: var(--tier-silver);
    box-shadow: 0 14px 28px -6px
      color-mix(in srgb, var(--tier-silver) 55%, transparent);
  }
  .badge-box.tier-gold:hover {
    border-color: var(--tier-gold);
    box-shadow: 0 14px 28px -6px
      color-mix(in srgb, var(--tier-gold) 55%, transparent);
  }

  .lift-name {
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
</style>
