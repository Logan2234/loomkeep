<script lang="ts">
  import { getFeed } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import ActivityItem from "$lib/components/ActivityItem.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ActivityEventDto, PagedResult } from "@loomkeep/shared";

  const feed = createApiInfiniteQuery<
    PagedResult<ActivityEventDto>,
    number,
    ActivityEventDto
  >(() => ({
    key: keys.feed.all(),
    fetch: (page) => getFeed(page),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));
</script>

<div class="mx-auto max-w-2xl px-4 py-6 md:py-8">
  <PageHeader
    icon="users"
    title={m.feed_title()}
    subtitle={m.feed_subtitle()} />

  {#if feed.loading}
    <CardRowSkeleton count={6} />
  {:else if feed.error}
    <p class="text-danger text-sm">{feed.error}</p>
  {:else if feed.data.length === 0}
    <EmptyState>
      <p class="font-display text-lg font-bold">
        {m.feed_empty_title()}
      </p>
      <p class="mt-1 text-sm">
        {m.feed_empty_body()}
      </p>
      <a href="/app/profile" class="btn btn-ghost mt-3"
        >{m.feed_share_profile()}</a>
    </EmptyState>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each feed.data as event (event.id)}
        <ActivityItem {event} />
      {/each}
    </ul>

    {#if feed.hasNextPage}
      <div class="mt-4 flex justify-center">
        <button
          class="btn btn-ghost"
          disabled={feed.isFetchingNextPage}
          onclick={() => feed.fetchNextPage()}>
          {feed.isFetchingNextPage ? m.common_loading() : m.common_see_more()}
        </button>
      </div>
    {/if}
  {/if}
</div>
