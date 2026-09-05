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
  <div class="badge-showcase">
    {#each badges as badge (badge.key)}
      <Tooltip text={achievementDescription(badge)} placement="top">
        <div
          use:tilt
          class="badge-box border-border bg-surface tier-{badge.tier}">
          <span class="lift-med">
            <AchievementMedallion icon={entryIcon(badge)} tier={badge.tier} />
          </span>
          <span class="lift-name">{achievementName(badge)}</span>
        </div>
      </Tooltip>
    {/each}
  </div>
{/if}

<style>
  .badge-showcase {
    display: flex;
    gap: 0.6rem;
    /* Lets a child's tilt rotate in 3D instead of just skewing flat. */
    perspective: 700px;
  }

  .badge-box {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    text-align: center;
    width: 6.25rem;
    max-width: 6.25rem;
    padding: 0.75rem 0.5rem;
    border-radius: 0.85rem;
    border-width: 1px;
    border-style: solid;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    transform-style: preserve-3d;
    cursor: default;
    transition:
      box-shadow 220ms ease,
      border-color 220ms ease;
  }

  /* The tilt itself is set inline by the `tilt` action (rotateX/rotateY on
     pointer move) — this only adds the "catches the light" glow, tinted per
     tier, same tokens the achievement medallions already use. */
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

  /* Depth cue: the medallion and name sit slightly proud of the box's own
     plane, so the tilt reads as a real object rather than a flat sticker. */
  .lift-med {
    display: block;
    transform: translateZ(18px);
  }
  .lift-name {
    display: block;
    transform: translateZ(10px);
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
</style>
