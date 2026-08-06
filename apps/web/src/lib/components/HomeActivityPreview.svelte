<script lang="ts">
  import { getFeedPreview } from "$lib/api/client";
  import { appConfig } from "$lib/config.svelte";
  import ActivityItem from "$lib/components/ActivityItem.svelte";
  import type { ActivityEventDto } from "@loomkeep/shared";

  // Home-page teaser of the activity feed. Social-gated, best-effort, and hides
  // itself entirely when empty so it never clutters a fresh dashboard. The full
  // feed lives at /feed.
  let {
    limit,
  }: {
    /** Cap the number of events shown. */
    limit?: number;
  } = $props();

  let events = $state<ActivityEventDto[]>([]);
  let loaded = $state(false);

  $effect(() => {
    if (!appConfig.socialEnabled) return;
    getFeedPreview()
      .then((e) => (events = limit ? e.slice(0, limit) : e))
      .catch(() => (events = []))
      .finally(() => (loaded = true));
  });
</script>

{#if appConfig.socialEnabled && loaded && events.length > 0}
  <section class="card p-4">
    <div class="mb-4 flex items-baseline justify-between">
      <p class="timecode text-xs uppercase">Dernières activités</p>
      <a href="/feed" class="text-dim hover:text-fg text-sm font-semibold">
        Voir le fil →
      </a>
    </div>
    <ul class="flex flex-col gap-2">
      {#each events as event (event.id)}
        <ActivityItem {event} />
      {/each}
    </ul>
  </section>
{/if}
