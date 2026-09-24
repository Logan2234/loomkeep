<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getFeed } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { auth } from "$lib/auth.svelte";
  import ActivityItem from "$lib/components/ActivityItem.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { isDomainEnabled, orderedDomains } from "$lib/domains";
  import { m } from "$lib/paraglide/messages.js";
  import type { ActivityEventDto, Domain, PagedResult } from "@loomkeep/shared";

  type Tab = "ALL" | Domain;

  // Only domains the viewer keeps enabled — the API leaves the others out of
  // the feed altogether, so a tab for one would always be empty.
  const domainTabs = $derived(
    orderedDomains(auth.user?.domainOrder).filter(
      (d) => !DOMAINS[d].comingSoon && isDomainEnabled(d),
    ),
  );
  const tabs = $derived<{ value: Tab; label: string }[]>([
    { value: "ALL", label: m.common_all() },
    ...domainTabs.map((d) => ({ value: d, label: DOMAINS[d].label })),
  ]);

  // In the URL so the tab survives a reload and a shared link. A domain the
  // viewer has since turned off falls back to every domain.
  const domain = $derived.by<Domain | null>(() => {
    const requested = page.url.searchParams.get("domain");
    return domainTabs.find((d) => d === requested) ?? null;
  });

  function changeTab(next: Tab) {
    const url = new URL(page.url);
    if (next === "ALL") url.searchParams.delete("domain");
    else url.searchParams.set("domain", next);
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  const feed = createApiInfiniteQuery<
    PagedResult<ActivityEventDto>,
    number,
    ActivityEventDto
  >(() => ({
    key: keys.feed.list(domain),
    fetch: (page) => getFeed(page, domain ?? undefined),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));
</script>

<div class="mx-auto max-w-2xl px-4 py-6 md:py-8">
  <PageHeader
    icon="users"
    title={m.common_activity_feed()}
    subtitle={m.feed_subtitle()} />

  {#if domainTabs.length > 1}
    <Tabs
      class="mb-5"
      label={m.common_activity_feed()}
      {tabs}
      current={domain ?? "ALL"}
      onSelect={changeTab} />
  {/if}

  {#if feed.loading}
    <CardRowSkeleton count={6} />
  {:else if feed.error}
    <p class="text-danger text-sm">{feed.error}</p>
  {:else if feed.data.length === 0 && domain}
    <EmptyState>{m.feed_empty_domain()}</EmptyState>
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
