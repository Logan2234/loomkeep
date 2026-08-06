<script lang="ts">
  import { ApiError, getCalendar } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type { CalendarEntryDto } from "@loomkeep/shared";
  import { SvelteDate } from "svelte/reactivity";

  let entries = $state<CalendarEntryDto[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    getCalendar()
      .then((result) => (entries = result))
      .catch((err) => {
        error = err instanceof ApiError ? err.message : "Chargement impossible";
      })
      .finally(() => (loading = false));
  });

  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });
  const dayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  function relativeLabel(date: Date): string {
    const today = new SvelteDate();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Demain";
    const w = weekday.format(date);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }

  const code = (e: CalendarEntryDto) =>
    `S${String(e.seasonNumber).padStart(2, "0")}E${String(e.episodeNumber).padStart(2, "0")}`;
  const href = (e: CalendarEntryDto) =>
    `/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`;

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
          date: dayLabel.format(d),
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
    title="Calendrier"
    subtitle="Les prochains épisodes de ce que tu suis." />

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
                      · {e.episodeTitle}{/if}
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
