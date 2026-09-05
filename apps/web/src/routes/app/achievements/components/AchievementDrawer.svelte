<script lang="ts">
  // Compact-viewport counterpart of the desktop unfold: same medallion,
  // same ladder, same note — a tap opens it instead of a hover.
  import Drawer from "$lib/components/Drawer.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { AchievementGroup } from "../achievements";
  import {
    achievementDescription,
    achievementName,
    groupIcon,
  } from "../labels";
  import AchievementLadder from "./AchievementLadder.svelte";
  import AchievementMedallion from "$lib/components/AchievementMedallion.svelte";

  let {
    group,
    onclose,
    equippedCount,
  }: {
    group: AchievementGroup;
    onclose: () => void;
    equippedCount: number;
  } = $props();

  const focusEntry = $derived(group.next ?? group.entries.at(-1)!);
</script>

<Drawer {onclose} labelledby="achievement-drawer-title">
  <div class="flex flex-col gap-3 px-5 pt-2 pb-6">
    <div class="flex items-center gap-3">
      <AchievementMedallion icon={groupIcon(group)} tier={group.reachedTier} />
      <div class="min-w-0">
        <h2
          id="achievement-drawer-title"
          class="font-display text-fg text-base font-bold">
          {achievementName(focusEntry)}
        </h2>
        <p class="text-dim mt-0.5 text-xs leading-snug">
          {achievementDescription(focusEntry)}
        </p>
      </div>
    </div>

    <div
      class="border-border rounded-lg border p-3"
      aria-label={m.gamification_details_label()}>
      <AchievementLadder {group} {equippedCount} />
    </div>

    <button type="button" class="btn btn-ghost w-full" onclick={onclose}>
      {m.gamification_drawer_close()}
    </button>
  </div>
</Drawer>
