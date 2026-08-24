<script lang="ts">
  import { ApiError, getCalendar } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import CalendarSubscribeModal from "$lib/components/CalendarSubscribeModal.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import PremiumLockBadge from "$lib/components/PremiumLockBadge.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type { CalendarEntryDto } from "@loomkeep/shared";
  import { SvelteDate } from "svelte/reactivity";

  const calendarLocked = $derived(
    liveFlags.isEnabled("premium-features") && !auth.isPremium,
  );

  let entries = $state<CalendarEntryDto[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showSubscribeModal = $state(false);

  $effect(() => {
    getCalendar()
      .then((result) => (entries = result))
      .catch((err) => {
        error =
          err instanceof ApiError
            ? err.message
            : m.common_fetch_error_fallback();
      })
      .finally(() => (loading = false));
  });

  const WEEKDAY_LONG_OPTIONS: Intl.DateTimeFormatOptions = { weekday: "long" };
  const DAY_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  };

  function relativeLabel(date: Date): string {
    const today = new SvelteDate();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Demain";
    const w = formatDate(date, WEEKDAY_LONG_OPTIONS);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }

  const code = (e: CalendarEntryDto) =>
    `S${String(e.seasonNumber).padStart(2, "0")}E${String(e.episodeNumber).padStart(2, "0")}`;
  const href = (e: CalendarEntryDto) =>
    `/app/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`;

  // Group the (already date-sorted) episodes by calendar day.
  const days = $derived.by(() => {
    const groups: {
      key: string;
      label: string;
      date: string;
      items: CalendarEntryDto[];
    }[] = [];
    for (const e of entries) {
      const d = new Date(e.airDate);
      const key = d.toDateString();
      let group = groups.at(-1);
      if (!group || group.key !== key) {
        group = {
          key,
          label: relativeLabel(d),
          date: formatDate(d, DAY_LABEL_OPTIONS),
          items: [],
        };
        groups.push(group);
      }
      group.items.push(e);
    }
    return groups;
  });
</script>

<div class="mx-auto max-w-4xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="calendar"
    title={m.common_calendar()}
    subtitle="Les prochains épisodes de ce que tu suis.">
    {#snippet actions()}
      {#snippet calendarButton()}
        <button
          class="btn btn-ghost shrink-0"
          disabled={calendarLocked}
          onclick={() => (showSubscribeModal = true)}>
          <Icon name="calendar" class="mr-1.5 inline h-4 w-4" />
          Ajouter à mon agenda
          {#if isFeatureNew("calendar-subscribe")}
            <span class="ml-1.5 inline-flex"><NewBadge /></span>
          {/if}
        </button>
      {/snippet}
      {#if calendarLocked}
        <Tooltip text={m.common_premium_locked()} class="inline-flex shrink-0">
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
  {:else if days.length === 0}
    <EmptyState>Aucun épisode à venir dans ce que tu suis.</EmptyState>
  {:else}
    <div class="flex flex-col gap-8">
      {#each days as day (day.key)}
        <section>
          <div
            class="border-border mb-3 flex items-baseline gap-3 border-b pb-2">
            <h2 class="font-display text-lg font-bold">{day.label}</h2>
            <span class="timecode text-sm">{day.date}</span>
          </div>
          <div class="flex flex-col gap-2.5">
            {#each day.items as e (e.mediaItem.id + code(e))}
              <a
                href={href(e)}
                class="card hover:border-accent flex items-center gap-4 p-3 transition-[border-color]">
                <div class="w-12 shrink-0 overflow-hidden rounded-md">
                  <Poster
                    src={e.mediaItem.posterUrl}
                    title={e.mediaItem.title} />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-display truncate font-semibold">
                    {e.mediaItem.title}
                  </p>
                  <p class="timecode text-sm">
                    {code(e)}{#if e.episodeTitle}
                      &nbsp;· {e.episodeTitle}{/if}
                  </p>
                </div>
              </a>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>

{#if showSubscribeModal}
  <CalendarSubscribeModal onclose={() => (showSubscribeModal = false)} />
{/if}
