<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { createApiInfiniteQuery } from "#lib/api/infinite-query.svelte.js";
  import { keys } from "#lib/api/keys.js";
  import {
    getNotificationCounts,
    getNotificationHistory,
  } from "#lib/api/notifications.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getFollowRequests } from "#lib/api/social.js";
  import CardRowSkeleton from "#lib/components/CardRowSkeleton.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import LoadMoreButton from "#lib/components/LoadMoreButton.svelte";
  import FollowRequests from "#lib/components/notifications/FollowRequests.svelte";
  import NotificationRow from "#lib/components/notifications/NotificationRow.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import SegmentedControl from "#lib/components/SegmentedControl.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import {
    cascade,
    CASCADE_STEP_MS,
    notificationActions,
  } from "#lib/notifications/actions.svelte.js";
  import { type DaySection, groupByDay } from "#lib/notifications/cache.js";
  import { rowIn, rowOut } from "#lib/notifications/transitions.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { NotificationDto, PagedResult } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { fade } from "svelte/transition";

  type Filter = "all" | "unread";

  const queryClient = useQueryClient();
  const actions = notificationActions(queryClient);
  const reduced = prefersReducedMotion();
  /** What came after this lit up as it arrives; what was there doesn't. */
  const mountedAt = new Date().toISOString();

  // In the URL, so a reload or the back button keeps it.
  const filter = $derived<Filter>(
    page.url.searchParams.get("filter") === "unread" ? "unread" : "all",
  );

  function changeFilter(next: Filter) {
    const url = new URL(page.url.href);
    if (next === "all") url.searchParams.delete("filter");
    else url.searchParams.set("filter", next);
    void goto(url, { replace: true, reset: false });
  }

  const history = createApiInfiniteQuery<
    PagedResult<NotificationDto>,
    number,
    NotificationDto
  >(() => ({
    key: keys.notifications.history(filter === "unread"),
    fetch: (pageParam) =>
      getNotificationHistory(pageParam, { unread: filter === "unread" }),
    getPageItems: (p) => p.items,
    initialPageParam: 1,
    getNextPageParam: (last, all) =>
      last.hasMore ? all.length + 1 : undefined,
    // Switching filter, the rows that don't belong leave rather than the
    // whole list blinking out.
    keepPreviousData: true,
  }));
  const countsQuery = createApiQuery(() => ({
    key: keys.notifications.counts(),
    fetch: getNotificationCounts,
  }));
  const requestsQuery = createApiQuery(() => ({
    key: keys.social.followRequests(),
    fetch: getFollowRequests,
  }));

  const entries = $derived(history.data ?? []);
  const sections = $derived(groupByDay(entries));
  const requests = $derived(requestsQuery.data ?? []);
  const unread = $derived(countsQuery.data?.unread ?? 0);

  const SECTION_TITLES: Record<DaySection, () => string> = {
    today: () => m.common_today(),
    yesterday: () => m.common_yesterday(),
    week: () => m.notif_day_week(),
    older: () => m.notif_day_older(),
  };

  // Opening the page is seeing what's on it: the bell's badge starts over.
  $effect(() => {
    actions.seen();
  });

  /** Positions across sections, for the "mark all read" cascade. */
  const positions = $derived(
    new Map(entries.map((entry, i) => [entry.id, i] as const)),
  );
</script>

<div class="mx-auto max-w-2xl px-4 py-6 md:py-8">
  <PageHeader
    icon="bell"
    title={m.common_notifications()}
    back="/app"
    backInHistory
    subtitle={m.notif_page_subtitle()}
    isNew={isFeatureNew("notification-history")}
    class="mb-5" />

  <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
    <SegmentedControl
      label={m.common_notifications()}
      options={[
        { value: "all", label: m.notif_filter_all() },
        { value: "unread", label: m.notif_filter_unread(), count: unread },
      ]}
      value={filter}
      onChange={changeFilter} />
    {#if unread > 0}
      <button
        type="button"
        transition:fade={{ duration: reduced ? 0 : 150 }}
        class="link-accent inline-flex items-center gap-1.5 text-sm"
        onclick={() => actions.readAll(entries.length)}>
        <Icon name="check-check" class="h-4 w-4" />
        {m.notif_mark_all_read()}
      </button>
    {/if}
  </div>

  {#if requests.length > 0}
    <section class="pb-6" in:rowIn out:rowOut>
      <h2 class="day-title">{m.notif_follow_requests()}</h2>
      <div class="card overflow-hidden p-0">
        <FollowRequests {requests} />
      </div>
    </section>
  {/if}

  {#if history.loading && entries.length === 0}
    <CardRowSkeleton />
  {:else if history.error && entries.length === 0}
    <p class="text-danger text-sm">{history.error}</p>
  {:else if entries.length === 0}
    <div
      in:fade={{ duration: reduced ? 0 : 200 }}
      class="text-dim flex flex-col items-center gap-2 px-6 py-12 text-center text-sm">
      <span class="bg-surface-2 grid h-12 w-12 place-items-center rounded-full">
        <Icon
          name={filter === "unread" ? "check-check" : "bell"}
          class="h-5 w-5" />
      </span>
      <b class="font-display text-fg text-base">
        {filter === "unread"
          ? m.notif_empty_unread_title()
          : m.notif_empty_title()}
      </b>
      {filter === "unread" ? m.notif_empty_unread() : m.notif_empty()}
    </div>
  {:else}
    {#each sections as group (group.section)}
      <section class="pb-6" in:rowIn out:rowOut>
        <h2 class="day-title">{SECTION_TITLES[group.section]()}</h2>
        <ul class="card overflow-hidden p-0">
          {#each group.entries as entry (entry.id)}
            {@const index = positions.get(entry.id) ?? 0}
            <li
              in:rowIn={{ flash: entry.createdAt > mountedAt }}
              out:rowOut={{ delay: cascade.on ? index * CASCADE_STEP_MS : 0 }}
              class="border-border/60 [&+&]:border-t">
              <NotificationRow
                {entry}
                {index}
                onread={actions.read}
                onunread={actions.unread}
                onremove={actions.remove} />
            </li>
          {/each}
        </ul>
      </section>
    {/each}

    {#if history.hasNextPage}
      <div class="flex justify-center">
        <LoadMoreButton query={history} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .day-title {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-bottom: 0.5rem;
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 700;
  }
  .day-title::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }
</style>
