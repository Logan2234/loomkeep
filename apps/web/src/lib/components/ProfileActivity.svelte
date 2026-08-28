<script lang="ts">
  import { getUserActivity } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import ActivityItem from "$lib/components/ActivityItem.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ActivityEventDto, ActivityFeedDto } from "@loomkeep/shared";

  // A user's recent activity timeline, shown under their profile stats. Loads
  // its own data (visibility-filtered server-side) and hides when empty.
  let { username }: { username: string } = $props();

  const activity = createApiInfiniteQuery<
    ActivityFeedDto,
    string | undefined,
    ActivityEventDto
  >(() => ({
    key: keys.profile.activity(username),
    fetch: (cursor) => getUserActivity(username, cursor),
    getPageItems: (page) => page.events,
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  }));
</script>

{#if !activity.loading && activity.data.length > 0}
  <section class="mt-6">
    <h2 class="timecode mb-3 text-[0.62rem] tracking-[0.18em] uppercase">
      Activité récente
    </h2>
    <ul class="flex flex-col gap-2">
      {#each activity.data as event (event.id)}
        <ActivityItem {event} />
      {/each}
    </ul>
    {#if activity.hasNextPage}
      <div class="mt-3 flex justify-center">
        <button
          class="btn btn-ghost btn-sm"
          disabled={activity.isFetchingNextPage}
          onclick={() => activity.fetchNextPage()}>
          {activity.isFetchingNextPage
            ? m.common_loading()
            : m.common_see_more()}
        </button>
      </div>
    {/if}
  </section>
{/if}
