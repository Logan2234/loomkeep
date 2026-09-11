<script lang="ts">
  // Merges what used to be three separate, unlabelled blocks (cumulative
  // watch time / most active year, top genres, and a standalone heatmap
  // teaser) into one card — each was gated by a fragment of the same
  // activityStats.visible check and read as loose debris rather than one
  // "Statistiques" module. The review/comment/list counts that used to live
  // here moved to ProfileHeader's ruler — they're identity counters, not
  // activity metrics. Renders nothing at all when every part is empty.
  import CalendarHeatmap from "$lib/components/stats/CalendarHeatmap.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ProfileSectionHeading from "$lib/components/profile/ProfileSectionHeading.svelte";
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type { SocialProfileDto } from "@loomkeep/shared";

  let { profile }: { profile: SocialProfileDto } = $props();

  const stats = $derived(profile.activityStats);
  const watchDays = $derived(Math.round(stats.totalMinutes / 1440));

  const FULL_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const firstActivity = $derived(
    stats.firstActivityAt
      ? formatDate(stats.firstActivityAt, FULL_DATE_OPTIONS)
      : null,
  );
  // The heatmap teaser spans the last 90 days — count the days with any
  // activity in it, rather than a "cette année" wording that would assume a
  // full-year window this teaser deliberately isn't.
  const activeRecentDays = $derived(
    stats.heatmap.filter((d) => d.count > 0).length,
  );

  const tilesVisible = $derived(
    stats.visible && (watchDays > 0 || stats.mostActiveYear !== null),
  );
  const genresVisible = $derived(stats.visible && stats.topGenres.length > 0);
  const heatmapVisible = $derived(
    stats.visible && stats.heatmap.some((d) => d.count > 0),
  );
  const anyVisible = $derived(tilesVisible || genresVisible || heatmapVisible);
</script>

{#if anyVisible}
  <section>
    <ProfileSectionHeading label={m.profile_stats_section()} />
    <div class="card p-5">
      {#if tilesVisible}
        <div
          class="border-border grid grid-cols-2 overflow-hidden rounded-xl border">
          {#if watchDays > 0}
            <div
              class="p-4 {stats.mostActiveYear !== null
                ? 'border-border border-r'
                : 'col-span-2'}">
              <p class="font-display text-2xl font-extrabold tracking-tight">
                {watchDays}<span class="text-dim text-xs font-bold"
                  >{m.common_days_short()}</span>
              </p>
              <p class="text-dim mt-0.5 text-xs">
                {m.profile_watch_time_cumulative()}
              </p>
            </div>
          {/if}
          {#if stats.mostActiveYear !== null}
            <div class="p-4 {watchDays > 0 ? '' : 'col-span-2'}">
              <p class="font-display text-2xl font-extrabold tracking-tight">
                {stats.mostActiveYear}
              </p>
              <p class="text-dim mt-0.5 text-xs">
                {m.profile_most_active_year()}
              </p>
            </div>
          {/if}
        </div>
      {/if}

      {#if genresVisible}
        <div class="mt-3 flex flex-wrap gap-1.5">
          {#each stats.topGenres as g (g.label)}
            <span
              class="bg-surface-2 border-border rounded-full border px-2.5 py-1 text-xs">
              {g.label}<b class="timecode ml-1 font-normal">{g.count}</b>
            </span>
          {/each}
        </div>
      {/if}

      {#if heatmapVisible}
        <div
          class={tilesVisible || genresVisible
            ? "border-border mt-4 border-t pt-4"
            : ""}>
          <p
            class="text-dim mb-2.5 font-mono text-[11px] tracking-[0.16em] uppercase">
            {m.common_activity()}
          </p>
          <CalendarHeatmap days={stats.heatmap} legend={false} compact />
          <p class="mt-3 text-sm leading-relaxed">
            {m.common_active()}
            <b class="font-bold"
              >{m.profile_activity_days({ days: activeRecentDays })}</b>
            {m.profile_activity_summary_suffix()}
          </p>
          {#if firstActivity}
            <p class="text-dim mt-0.5 text-xs">
              {m.profile_activity_first_trace({ date: firstActivity })}
            </p>
          {/if}
          <a
            href="/app/stats"
            class="link-accent group mt-2.5 inline-flex items-center gap-1 text-xs">
            {m.profile_activity_view_stats()}
            <Icon
              name="arrow-right"
              class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      {/if}
    </div>
  </section>
{/if}
