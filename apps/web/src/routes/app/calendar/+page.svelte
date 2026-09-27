<script lang="ts">
  import { getCalendar, updateLibraryEntry } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import CalendarSubscribeModal from "$lib/ee/calendar/CalendarSubscribeModal.svelte";
  import { useEeLock } from "$lib/ee/license.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import PremiumLockBadge from "$lib/components/PremiumLockBadge.svelte";
  import TabPanels from "$lib/components/TabPanels.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type { CalendarEntryDto, MediaType } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import {
    type CalendarDay,
    type CalendarFilter,
    groupByDay,
    matchesFilter,
    WEEK_DAYS,
  } from "./calendar-days";
  import AlertBellButton from "./components/AlertBellButton.svelte";

  const eeLock = useEeLock();
  const calendarLocked = $derived(eeLock.locked);

  let showSubscribeModal = $state(false);

  const calendarQuery = createApiQuery(() => ({
    key: keys.calendar.upcoming(),
    fetch: getCalendar,
  }));
  const entries = $derived(calendarQuery.data ?? []);
  const loading = $derived(calendarQuery.loading);
  const error = $derived(calendarQuery.error);

  const queryClient = useQueryClient();

  // Muting is per show, not per episode: flipping one row flips every
  // upcoming episode of that series, since they all share the entry.
  const alertsMut = createApiMutation(() => ({
    mutate: (args: { entryId: string; muted: boolean; title: string }) =>
      updateLibraryEntry(args.entryId, { episodeAlertsMuted: args.muted }),
    onSuccess: (_, { entryId, muted }) =>
      queryClient.setQueryData<CalendarEntryDto[]>(
        keys.calendar.upcoming(),
        (prev) =>
          prev?.map((e) =>
            e.entryId === entryId ? { ...e, episodeAlertsMuted: muted } : e,
          ),
      ),
    successToast: (_, { muted, title }) =>
      muted
        ? m.media_episode_alerts_muted_toast({ title })
        : m.media_episode_alerts_unmuted_toast({ title }),
    errorToast: true,
  }));

  function toggleAlerts(e: CalendarEntryDto) {
    alertsMut.mutate({
      entryId: e.entryId,
      muted: !e.episodeAlertsMuted,
      title: e.mediaItem.title,
    });
  }

  let filter = $state<CalendarFilter>("all");

  // Each tab counts shows, not episodes: the same series airing three times
  // this week is still one series to follow (or to mute).
  function showCount(f: CalendarFilter): number {
    return new Set(
      entries.filter((e) => matchesFilter(e, f)).map((e) => e.entryId),
    ).size;
  }

  const filterTabs = $derived<{ value: CalendarFilter; label: string }[]>([
    { value: "all", label: `${m.calendar_filter_all()} (${showCount("all")})` },
    {
      value: "series",
      label: `${m.calendar_filter_series()} (${showCount("series")})`,
    },
    {
      value: "anime",
      label: `${m.calendar_filter_anime()} (${showCount("anime")})`,
    },
    {
      value: "muted",
      label: `${m.calendar_alerts_muted()} (${showCount("muted")})`,
    },
  ]);

  const days = $derived(
    groupByDay(entries.filter((e) => matchesFilter(e, filter))),
  );
  const hasAny = $derived(days.some((d) => d.items.length > 0));

  const TYPE_LABELS: Record<MediaType, () => string> = {
    MOVIE: () => m.media_movie(),
    SERIES: () => m.media_series(),
    ANIME: () => m.media_anime_label(),
  };

  const WEEKDAY_LONG_OPTIONS: Intl.DateTimeFormatOptions = { weekday: "long" };
  const WEEKDAY_SHORT_OPTIONS: Intl.DateTimeFormatOptions = {
    weekday: "short",
  };
  const DAY_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  };

  function relativeLabel(day: CalendarDay): string {
    if (day.offset === 0) return m.common_today();
    if (day.offset === 1) return m.common_tomorrow();
    const w = formatDate(day.date, WEEKDAY_LONG_OPTIONS);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }

  function stripLabel(day: CalendarDay): string {
    const label = `${relativeLabel(day)}, ${formatDate(day.date, DAY_LABEL_OPTIONS)}`;
    const count = day.items.length;
    if (count === 0) return m.calendar_strip_none({ day: label });
    if (count === 1) return m.calendar_strip_one({ day: label });
    return m.calendar_strip_many({ day: label, count });
  }

  const dayId = (day: CalendarDay) => `calendar-${day.key}`;

  const code = (e: CalendarEntryDto) =>
    `S${String(e.seasonNumber).padStart(2, "0")}E${String(e.episodeNumber).padStart(2, "0")}`;
  const href = (e: CalendarEntryDto) =>
    `/app/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`;
  const rowKey = (e: CalendarEntryDto) => e.mediaItem.id + code(e);
</script>

{#snippet badges(e: CalendarEntryDto)}
  <span
    class="border-border text-dim shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold">
    {TYPE_LABELS[e.mediaItem.type]()}
  </span>
  {#if e.episodesBehind > 0}
    <span
      class="border-accent/40 text-accent shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.65rem]">
      {m.calendar_behind({ count: e.episodesBehind })}
    </span>
  {/if}
{/snippet}

<div class="mx-auto max-w-4xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="calendar"
    title={m.common_calendar()}
    subtitle={m.calendar_subtitle()}
    isNew={isFeatureNew("calendar-redesign")}>
    {#snippet actions()}
      {#snippet calendarButton()}
        <button
          class="btn btn-ghost shrink-0"
          disabled={calendarLocked}
          onclick={() => (showSubscribeModal = true)}>
          <Icon name="calendar" class="mr-1.5 inline h-4 w-4" />
          {m.calendar_subscribe_button()}
          {#if isFeatureNew("release-feed")}
            <span class="ml-1.5"><NewBadge /></span>
          {/if}
        </button>
      {/snippet}
      {#if calendarLocked}
        <Tooltip text={m.premium_locked()} class="inline-flex shrink-0">
          {@render calendarButton()}
          <PremiumLockBadge />
        </Tooltip>
      {:else}
        {@render calendarButton()}
      {/if}
    {/snippet}
  </PageHeader>

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if loading}
    <CardRowSkeleton count={5} />
  {:else if entries.length === 0}
    <EmptyState>{m.calendar_no_episodes()}</EmptyState>
  {:else}
    <Tabs
      class="mb-5"
      label={m.calendar_filter_label()}
      tabs={filterTabs}
      current={filter}
      idPrefix="calendar-filter"
      onSelect={(next) => (filter = next)} />

    <TabPanels current={filter} idPrefix="calendar-filter">
      {#if !hasAny}
        <EmptyState>{m.calendar_filter_empty()}</EmptyState>
      {:else}
        <nav
          aria-label={m.calendar_week_strip()}
          class="mb-8 grid grid-cols-7 gap-1.5 sm:gap-2">
          {#each days.slice(0, WEEK_DAYS) as day (day.key)}
            <a
              href="#{dayId(day)}"
              aria-label={stripLabel(day)}
              class="flex flex-col items-center gap-0.5 rounded-xl border py-2 transition-colors sm:gap-1 sm:py-3 {day.offset ===
              0
                ? 'border-accent bg-surface-2'
                : 'border-border hover:border-dim'}">
              <span
                class="text-[0.6rem] font-semibold tracking-wide uppercase sm:text-xs {day.offset ===
                0
                  ? 'text-accent'
                  : 'text-dim'}">
                {formatDate(day.date, WEEKDAY_SHORT_OPTIONS).replace(".", "")}
              </span>
              <span class="font-mono text-base font-bold sm:text-xl">
                {day.date.getDate()}
              </span>
              <span class="text-dim font-mono text-[0.6rem] sm:text-xs">
                {day.items.length > 0
                  ? m.calendar_strip_count({ count: day.items.length })
                  : "—"}
              </span>
            </a>
          {/each}
        </nav>

        <div class="flex flex-col gap-6 md:gap-3">
          {#each days as day, i (day.key)}
            {#if day.offset >= WEEK_DAYS && (i === 0 || days[i - 1].offset < WEEK_DAYS)}
              <div class="flex items-center gap-3 pt-3">
                <span class="timecode text-xs tracking-widest uppercase">
                  {m.calendar_next_week()}
                </span>
                <div class="bg-border h-px flex-1"></div>
              </div>
            {/if}
            <section
              id={dayId(day)}
              aria-labelledby="{dayId(day)}-title"
              class="scroll-mt-6 md:grid md:grid-cols-[8rem_minmax(0,1fr)] md:gap-6 md:py-2">
              <div
                class="border-border mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2 md:mb-0 md:flex-col md:gap-0.5 md:border-0 md:pt-2 md:pb-0">
                {#if day.offset === 0 && day.items.length > 0}
                  <span
                    class="bg-accent text-accent-fg self-center rounded px-2 py-0.5 font-mono text-xs font-bold tracking-wider uppercase md:mb-1.5 md:self-start">
                    {m.calendar_tonight()}
                  </span>
                {/if}
                <h2
                  id="{dayId(day)}-title"
                  class="font-display text-lg font-bold {day.offset === 0
                    ? 'text-accent'
                    : ''}">
                  {relativeLabel(day)}
                </h2>
                <span class="timecode text-sm">
                  {formatDate(day.date, DAY_LABEL_OPTIONS)}
                </span>
              </div>
              {#if day.items.length === 0}
                <p
                  class="border-border text-dim flex min-h-24.5 items-center rounded-xl border border-dashed px-4 text-sm">
                  {m.calendar_day_off()}
                </p>
              {:else if day.offset === 0}
                <div class="grid gap-3 sm:grid-cols-2">
                  {#each day.items as e (rowKey(e))}
                    <!-- The bell sits beside the card's link, not inside it:
                         a click on it mutes, never opens the page. -->
                    <article
                      class="card has-[a:hover]:border-accent relative flex overflow-hidden transition-[border-color]">
                      <a href={href(e)} class="flex min-w-0 flex-1">
                        <div
                          class="w-28 shrink-0 transition-opacity {e.episodeAlertsMuted
                            ? 'opacity-50'
                            : ''}">
                          <Poster
                            src={e.mediaItem.posterUrl}
                            title={e.mediaItem.title}
                            alt="" />
                        </div>
                        <div
                          class="flex min-w-0 flex-1 flex-col gap-1.5 py-3.5 pr-14 pl-4">
                          <span class="timecode text-accent text-sm">
                            {code(e)}
                          </span>
                          <h3
                            class="font-display line-clamp-2 text-lg leading-snug font-bold">
                            {e.mediaItem.title}
                          </h3>
                          {#if e.episodeTitle}
                            <p class="text-dim line-clamp-2 text-sm">
                              {e.episodeTitle}
                            </p>
                          {/if}
                          <div class="mt-auto flex flex-wrap gap-1.5 pt-1">
                            {@render badges(e)}
                          </div>
                        </div>
                      </a>
                      <div class="absolute top-3 right-3">
                        <AlertBellButton
                          title={e.mediaItem.title}
                          muted={e.episodeAlertsMuted}
                          disabled={alertsMut.loading}
                          onToggle={() => toggleAlerts(e)} />
                      </div>
                    </article>
                  {/each}
                </div>
              {:else}
                <div class="flex flex-col gap-2.5">
                  {#each day.items as e (rowKey(e))}
                    <div
                      class="card has-[a:hover]:border-accent flex items-center gap-3 p-3 transition-[border-color] sm:gap-4">
                      <a
                        href={href(e)}
                        class="flex min-w-0 flex-1 items-center gap-4">
                        <div
                          class="w-12 shrink-0 overflow-hidden rounded-md transition-opacity {e.episodeAlertsMuted
                            ? 'opacity-50'
                            : ''}">
                          <Poster
                            src={e.mediaItem.posterUrl}
                            title={e.mediaItem.title}
                            alt="" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <div
                            class="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p
                              class="font-display max-w-full truncate font-semibold">
                              {e.mediaItem.title}
                            </p>
                            {@render badges(e)}
                          </div>
                          <p class="timecode mt-0.5 truncate text-sm">
                            {code(e)}{#if e.episodeTitle}
                              &nbsp;· {e.episodeTitle}{/if}
                          </p>
                        </div>
                      </a>
                      {#if e.episodeAlertsMuted}
                        <span
                          class="text-dim hidden shrink-0 text-xs sm:inline">
                          {m.calendar_alerts_muted()}
                        </span>
                      {/if}
                      <AlertBellButton
                        title={e.mediaItem.title}
                        muted={e.episodeAlertsMuted}
                        disabled={alertsMut.loading}
                        onToggle={() => toggleAlerts(e)} />
                    </div>
                  {/each}
                </div>
              {/if}
            </section>
          {/each}
        </div>
      {/if}
    </TabPanels>
  {/if}
</div>

{#if showSubscribeModal}
  <CalendarSubscribeModal onclose={() => (showSubscribeModal = false)} />
{/if}
