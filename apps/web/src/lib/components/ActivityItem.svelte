<script lang="ts">
  import { activityPhrase, activityRating } from "$lib/activity-phrase";
  import Avatar from "$lib/components/Avatar.svelte";
  import RelativeTime from "$lib/components/RelativeTime.svelte";
  import type { ActivityEventDto } from "@loomkeep/shared";

  let { event }: { event: ActivityEventDto } = $props();

  const rating = $derived(activityRating(event));
</script>

<li class="card flex items-center gap-3 p-3">
  <a href="/app/u/{event.actor.username}" class="shrink-0">
    <Avatar seed={event.actor.username} url={event.actor.avatarUrl} size={36} />
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
      <img src={event.imageUrl} alt="" class="h-14 w-10 rounded object-cover" />
    </svelte:element>
  {/if}
</li>
