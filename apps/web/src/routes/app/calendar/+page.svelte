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
  const filterTabs: { value: CalendarFilter; label: string }[] = [
    { value: "all", label: m.calendar_filter_all() },
    { value: "series", label: m.calendar_filter_series() },
    { value: "anime", label: m.calendar_filter_anime() },
    { value: "muted", label: m.calendar_alerts_muted() },
  ];

  const days = $derived(
    groupByDay(entries.filter((e) => matchesFilter(e, filter))),
  );
  const hasAny = $derived(days.some((d) => d.items.length > 0));
  // Today's episodes get the "Ce soir" cards; the day list then picks up
  // from tomorrow. An empty today stays in the list, as a day off.
  const tonight = $derived(days[0]?.items ?? []);
  const listDays = $derived(tonight.length > 0 ? days.slice(1) : days);

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

  const dayId = (day: CalendarDay) =>
    day.offset === 0 && tonight.length > 0
      ? "calendar-tonight"
      : `calendar-${day.key}`;

  const code = (e: CalendarEntryDto) =>
    `S${String(e.seasonNumber).padStart(2, "0")}E${String(e.episodeNumber).padStart(2, "0")}`;
  const href = (e: CalendarEntryDto) =>
    `/app/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`;
  const rowKey = (e: CalendarEntryDto) => e.mediaItem.id + code(e);
</script>

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
              class="flex flex-col items-center gap-1 rounded-xl border py-2 transition-colors sm:py-3 {day.offset ===
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
              <span class="flex h-1 gap-0.5" aria-hidden="true">
                {#each day.items.slice(0, 4) as e (rowKey(e))}
                  <span
                    class="h-1 w-1 rounded-full {e.episodeAlertsMuted
                      ? 'bg-border'
                      : 'bg-accent'}"></span>
                {/each}
              </span>
            </a>
          {/each}
        </nav>

        {#if tonight.length > 0}
          <section
            id="calendar-tonight"
            aria-labelledby="calendar-tonight-title"
            class="mb-10 scroll-mt-6">
            <div class="mb-3 flex items-center gap-3">
              <span
                class="bg-accent text-accent-fg rounded px-2 py-0.5 font-mono text-xs font-bold tracking-wider uppercase">
                {m.calendar_tonight()}
              </span>
              <h2
                id="calendar-tonight-title"
                class="font-display text-lg font-bold">
                {m.common_today()}
                <span class="timecode ml-1 text-sm font-normal">
                  {formatDate(days[0].date, DAY_LABEL_OPTIONS)}
                </span>
              </h2>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {#each tonight as e (rowKey(e))}
                <article
                  class="card has-[a:hover]:border-accent flex gap-4 p-3.5 transition-[border-color]">
                  <a
                    href={href(e)}
                    tabindex="-1"
                    aria-hidden="true"
                    class="w-20 shrink-0 self-start overflow-hidden rounded-lg transition-opacity {e.episodeAlertsMuted
                      ? 'opacity-50'
                      : ''}">
                    <Poster
                      src={e.mediaItem.posterUrl}
                      title={e.mediaItem.title}
                      alt="" />
                  </a>
                  <div class="flex min-w-0 flex-1 flex-col gap-1">
                    <span class="timecode text-accent text-sm">{code(e)}</span>
                    <h3 class="font-display truncate font-bold">
                      {e.mediaItem.title}
                    </h3>
                    {#if e.episodeTitle}
                      <p class="text-dim line-clamp-2 text-sm">
                        {e.episodeTitle}
                      </p>
                    {/if}
                    {#if e.episodesBehind > 0}
                      <p class="text-accent font-mono text-xs">
                        {m.calendar_behind({ count: e.episodesBehind })}
                      </p>
                    {/if}
                    <div
                      class="mt-auto flex items-center justify-between gap-2 pt-1">
                      <a href={href(e)} class="link-accent text-sm">
                        {m.calendar_open_details()}
                      </a>
                      <AlertBellButton
                        title={e.mediaItem.title}
                        muted={e.episodeAlertsMuted}
                        disabled={alertsMut.loading}
                        onToggle={() => toggleAlerts(e)} />
                    </div>
                  </div>
                </article>
              {/each}
            </div>
          </section>
        {/if}

        <div class="flex flex-col gap-6 md:gap-3">
          {#each listDays as day, i (day.key)}
            {#if day.offset >= WEEK_DAYS && (i === 0 || listDays[i - 1].offset < WEEK_DAYS)}
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
                class="border-border mb-3 flex items-baseline gap-3 border-b pb-2 md:mb-0 md:flex-col md:gap-0.5 md:border-0 md:pt-2 md:pb-0">
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
                  class="border-border text-dim rounded-xl border border-dashed px-4 py-3 text-sm">
                  {m.calendar_day_off()}
                </p>
              {:else}
                <div class="flex flex-col gap-2.5">
                  {#each day.items as e (rowKey(e))}
                    <div
                      class="card has-[a:hover]:border-accent flex items-center gap-3 p-3 pr-2 transition-[border-color] sm:gap-4">
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
                          <p class="font-display truncate font-semibold">
                            {e.mediaItem.title}
                          </p>
                          <p class="timecode truncate text-sm">
                            {code(e)}{#if e.episodeTitle}
                              &nbsp;· {e.episodeTitle}{/if}
                          </p>
                          <p class="text-dim mt-0.5 flex gap-1.5 text-xs">
                            <span>{TYPE_LABELS[e.mediaItem.type]()}</span>
                            {#if e.episodesBehind > 0}
                              <span class="text-accent font-mono">
                                · {m.calendar_behind({
                                  count: e.episodesBehind,
                                })}
                              </span>
                            {/if}
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
