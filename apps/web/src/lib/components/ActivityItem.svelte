<script lang="ts">
  import Avatar from "$lib/components/Avatar.svelte";
  import RelativeTime from "$lib/components/RelativeTime.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ActivityEventDto } from "@loomkeep/shared";

  let { event }: { event: ActivityEventDto } = $props();

  // Localized action phrase for an event. PROGRESS/LIST_ITEM_ADDED use their
  // aggregated count.
  function phrase(e: ActivityEventDto): string {
    switch (e.type) {
      case "ADDED":
        return m.activity_added();
      case "STARTED":
        return m.activity_started();
      case "FINISHED":
        return m.activity_finished();
      case "DROPPED":
        return m.activity_dropped();
      case "REWATCHED":
        return m.activity_rewatched();
      case "FAVORITED":
        return m.activity_favorited();
      case "REVIEWED":
        return m.activity_reviewed();
      case "PROGRESS":
        return e.count > 1
          ? m.activity_progress_count({ count: e.count })
          : m.activity_progress();
      case "LIST_CREATED":
        return m.activity_list_created();
      case "LIST_ITEM_ADDED":
        return e.count > 1
          ? m.activity_list_item_added_count({ count: e.count })
          : m.activity_list_item_added();
      case "LIST_SHARED":
        return m.activity_list_shared();
      default:
        return m.activity_updated();
    }
  }

  const rating = $derived(
    event.type === "REVIEWED" && typeof event.data.rating === "number"
      ? event.data.rating
      : null,
  );
</script>

<li class="card flex items-center gap-3 p-3">
  <a href="/app/u/{event.actor.username}" class="shrink-0">
    <Avatar seed={event.actor.username} url={event.actor.avatarUrl} size={36} />
  </a>

  <div class="min-w-0 flex-1">
    <p class="text-sm leading-snug">
      <a
        href="/app/u/{event.actor.username}"
        class="font-semibold hover:underline">
        {event.actor.displayName}
      </a>
      <span class="text-dim">{phrase(event)}</span>
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
      <img src={event.imageUrl} alt="" class="h-14 w-10 rounded object-cover" />
    </svelte:element>
  {/if}
</li>
