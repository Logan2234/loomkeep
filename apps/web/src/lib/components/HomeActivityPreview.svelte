<script lang="ts">
  import { getFeedPreview } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import ActivityItem from "$lib/components/ActivityItem.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";

  // Home-page teaser of the activity feed. Social-gated, best-effort, and hides
  // itself entirely when empty so it never clutters a fresh dashboard. The full
  // feed lives at /feed.
  let {
    limit,
  }: {
    /** Cap the number of events shown. */
    limit?: number;
  } = $props();

  const previewQuery = createApiQuery(() => ({
    key: keys.feed.preview(),
    fetch: getFeedPreview,
    enabled: appConfig.socialEnabled,
  }));

  const events = $derived(
    limit
      ? (previewQuery.data ?? []).slice(0, limit)
      : (previewQuery.data ?? []),
  );
</script>

{#if appConfig.socialEnabled && !previewQuery.loading && events.length > 0}
  <section class="card p-4">
    <div class="mb-4 flex items-baseline justify-between">
      <p class="timecode text-xs uppercase">{m.home_activity_title()}</p>
      <a href="/app/feed" class="btn-text">
        {m.home_activity_view_feed()}
      </a>
    </div>
    <ul class="flex flex-col gap-2">
      {#each events as event (event.id)}
        <ActivityItem {event} />
      {/each}
    </ul>
  </section>
{/if}
