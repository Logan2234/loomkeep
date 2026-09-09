<script lang="ts">
  import { getUserActivity } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { activityPhrase, activityRating } from "$lib/activity-phrase";
  import { keys } from "$lib/api/keys";
  import Avatar from "$lib/components/Avatar.svelte";
  import ProfileSectionHeading from "$lib/components/profile/ProfileSectionHeading.svelte";
  import RelativeTime from "$lib/components/RelativeTime.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ActivityEventDto, PagedResult } from "@loomkeep/shared";

  let { username }: { username: string } = $props();

  const activity = createApiInfiniteQuery<
    PagedResult<ActivityEventDto>,
    number,
    ActivityEventDto
  >(() => ({
    key: keys.profile.activity(username),
    fetch: (page) => getUserActivity(username, page),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));

  const DOMAIN_HUE: Record<string, string> = {
    MEDIA: "var(--stat-media)",
    GAME: "var(--stat-games)",
    BOOK: "var(--stat-books)",
    MUSIC: "var(--stat-music)",
  };
</script>

{#if !activity.loading && activity.data.length > 0}
  <section>
    <ProfileSectionHeading label={m.profile_recent_activity()} />
    <ul class="border-border ml-3.5 flex flex-col border-l pl-7">
      {#each activity.data as event (event.id)}
        {@const rating = activityRating(event)}
        {@const hue = DOMAIN_HUE[event.targetType] ?? "var(--dim)"}
        <li class="relative flex items-center gap-3 py-2.5">
          <a
            href="/app/u/{event.actor.username}"
            class="border-bg absolute -left-10.5 h-7 w-7 overflow-hidden rounded-full border-2">
            <Avatar
              seed={event.actor.username}
              url={event.actor.avatarUrl}
              size={28} />
          </a>

          <div class="min-w-0 flex-1">
            <p class="text-sm leading-snug wrap-anywhere">
              <a
                href="/app/u/{event.actor.username}"
                class="font-semibold hover:underline">
                {event.actor.displayName}
              </a>
              <span class="text-dim">{activityPhrase(event)}</span>
              {#if event.href}
                <a href={event.href} class="hover:text-accent font-medium">
                  {event.title}
                </a>
              {:else}
                <span class="font-medium">{event.title}</span>
              {/if}
            </p>
            <p class="text-dim mt-0.5 flex items-center gap-2 text-xs">
              {#if rating !== null}
                <span class="text-accent font-mono font-bold tabular-nums">
                  {rating}/10
                </span>
                <span aria-hidden="true">·</span>
              {/if}
              <RelativeTime iso={event.createdAt} class="timecode" />
            </p>
          </div>

          {#if event.imageUrl}
            <svelte:element
              this={event.href ? "a" : "div"}
              href={event.href ?? undefined}
              class="shrink-0">
              <img
                src={event.imageUrl}
                alt=""
                class="h-14 w-10 rounded-md object-cover" />
            </svelte:element>
          {:else}
            <div
              class="h-14 w-10 shrink-0 rounded-md"
              style="background: linear-gradient(155deg, color-mix(in srgb, {hue} 55%, var(--surface-2)), color-mix(in srgb, {hue} 10%, var(--surface-2)))"
              aria-hidden="true">
            </div>
          {/if}
        </li>
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
