<script lang="ts">
  import { getMyProfile, getMyProgression } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { profileHref } from "#lib/navigation.js";
  import { m } from "#lib/paraglide/messages.js";
  import { levelProgress, xpForLevel } from "@loomkeep/shared";

  // The phone home's level and streak, in two pills that lead to the profile:
  // they replace the level widget at the top of a phone's home.
  const username = $derived(auth.user?.username ?? "");
  const progressionQuery = createApiQuery(() => ({
    key: keys.gamification.progression(),
    fetch: getMyProgression,
  }));
  const profileQuery = createApiQuery(() => ({
    key: keys.profile.detail(username),
    fetch: getMyProfile,
    enabled: !!username,
  }));

  const xp = $derived(progressionQuery.data?.xp ?? null);
  const progress = $derived(xp === null ? null : levelProgress(xp));
  const levelSpan = $derived(
    progress ? xpForLevel(progress.level + 1) - xpForLevel(progress.level) : 0,
  );
  const activity = $derived(profileQuery.data?.activityStats);

  // XP earned while the home is open (an episode marked from a shelf) bumps
  // the pill once and floats the gain above it; the first load doesn't.
  const reduced = prefersReducedMotion();
  let lastXp: number | null = null;
  let gain = $state<{ xp: number; at: number } | null>(null);
  $effect(() => {
    if (xp === null) return;
    if (lastXp !== null && xp > lastXp && !reduced) {
      gain = { xp: xp - lastXp, at: Date.now() };
    }
    lastXp = xp;
  });
</script>

{#if progress}
  {@const pct = levelSpan > 0 ? (progress.xpInLevel / levelSpan) * 100 : 0}
  <div class="mb-3 flex items-center gap-2">
    <a
      href={profileHref()}
      class="bg-surface hover:bg-surface-2 relative inline-flex h-9 items-center gap-2.5 rounded-full pr-3.5 pl-1 transition-colors"
      aria-label={m.home_level_pill({ level: progress.level })}>
      {#key gain?.at}
        <span
          class="bg-accent text-accent-fg font-display grid h-7 w-7 place-items-center rounded-full text-sm font-extrabold {gain
            ? 'bump'
            : ''}">
          {progress.level}
        </span>
      {/key}
      <span
        class="bg-surface-2 h-1.5 w-16 overflow-hidden rounded-full"
        aria-hidden="true">
        <span
          class="bg-accent block h-full rounded-full transition-[width] duration-500 ease-out"
          style:width={`${pct}%`}></span>
      </span>
      <span class="text-dim text-micro tabular-nums" aria-hidden="true">
        {progress.xpInLevel}/{levelSpan}
      </span>
      {#key gain?.at}
        {#if gain}
          <span
            class="xp-gain text-accent text-micro pointer-events-none absolute -top-2 left-1/2 font-mono font-bold"
            aria-hidden="true">
            {m.gamification_xp_award({ xp: gain.xp })}
          </span>
        {/if}
      {/key}
    </a>
    {#if activity && activity.streakDays > 0}
      {@const streakLabel =
        activity.streakDays === 1
          ? m.gamification_streak_days_one({ days: activity.streakDays })
          : m.gamification_streak_days_many({ days: activity.streakDays })}
      <a
        href={profileHref()}
        class="bg-surface hover:bg-surface-2 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold tabular-nums transition-colors"
        aria-label={streakLabel}
        title={streakLabel}>
        <Icon name="flame" class="text-accent h-4 w-4" />
        {m.common_day_count_short({ days: activity.streakDays })}
      </a>
    {/if}
  </div>
{/if}

<style>
  .bump {
    animation: bump 0.32s ease-out;
  }

  @keyframes bump {
    40% {
      transform: scale(1.12);
    }
  }

  .xp-gain {
    animation: rise 0.9s ease-out forwards;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 4px);
    }
    30% {
      opacity: 1;
    }
    to {
      opacity: 0;
      transform: translate(-50%, -14px);
    }
  }
</style>
