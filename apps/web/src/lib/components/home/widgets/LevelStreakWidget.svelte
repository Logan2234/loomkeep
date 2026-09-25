<script lang="ts">
  import { getMyProfile, getMyProgression } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import StreakBadge from "$lib/components/StreakBadge.svelte";
  import { bodyOf, type BoxSize } from "$lib/home/sizing";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { m } from "$lib/paraglide/messages.js";
  import { levelProgress, xpForLevel } from "@loomkeep/shared";
  import WidgetShell from "../WidgetShell.svelte";

  let { size }: { size: BoxSize } = $props();

  const def = HOME_WIDGETS.levelStreak;
  // At 3 columns the "next level in…" half of the line doesn't fit.
  const roomy = $derived(bodyOf(size).width >= 280);

  // The same cache entries as the level-up bubble and the profile page.
  const progressionQuery = createApiQuery(() => ({
    key: keys.gamification.progression(),
    fetch: getMyProgression,
    enabled: !!auth.user,
  }));
  const username = $derived(auth.user?.username ?? "");
  const profileQuery = createApiQuery(() => ({
    key: keys.profile.detail(username),
    fetch: getMyProfile,
    enabled: !!auth.user,
  }));

  const xp = $derived(progressionQuery.data?.xp ?? null);
  const activity = $derived(profileQuery.data?.activityStats);
  // The profile's level card is too tall for a 3-row widget: the same
  // numbers, on one line and a bar.
  const progress = $derived(xp === null ? null : levelProgress(xp));
  const levelSpan = $derived(
    progress ? xpForLevel(progress.level + 1) - xpForLevel(progress.level) : 0,
  );
</script>

<WidgetShell icon={def.icon} title={def.title()} href="/app/achievements">
  {#if progressionQuery.loading}
    <div class="space-y-3">
      <div class="skeleton h-6 w-1/3 rounded"></div>
      <div class="skeleton h-2 w-full rounded"></div>
    </div>
  {:else if progress}
    <div class="flex h-full flex-col justify-center gap-2">
      <div class="flex items-center justify-between gap-2">
        <p class="font-display text-xl font-extrabold">
          {m.common_level()}
          <span class="text-accent">{progress.level}</span>
        </p>
        {#if activity?.visible}
          <StreakBadge
            days={activity.streakDays}
            securedToday={activity.streakSecuredToday}
            isSelf
            trackKey={auth.user ? `streak:${auth.user.id}` : undefined} />
        {/if}
      </div>
      <ProgressBar
        value={levelSpan > 0 ? (progress.xpInLevel / levelSpan) * 100 : 0}
        label={m.common_level()}
        height="h-2" />
      <p class="timecode truncate text-[0.65rem]">
        {roomy
          ? m.profile_level_progress({
              xpInLevel: progress.xpInLevel,
              xpForLevel: levelSpan,
              xpToNext: progress.xpToNext,
            })
          : m.home_level_xp({
              xpInLevel: progress.xpInLevel,
              xpForLevel: levelSpan,
            })}
      </p>
    </div>
  {:else}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_level_streak_empty()}
    </p>
  {/if}
</WidgetShell>
