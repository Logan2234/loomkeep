<script lang="ts">
  import Avatar from "$lib/components/Avatar.svelte";
  import RelativeTime from "$lib/components/RelativeTime.svelte";
  import type { ActivityEventDto } from "@loomkeep/shared";

  let { event }: { event: ActivityEventDto } = $props();

  // French action phrase for an event. PROGRESS uses its aggregated count.
  function phrase(e: ActivityEventDto): string {
    switch (e.type) {
      case "ADDED":
        return "a ajouté";
      case "STARTED":
        return "a commencé";
      case "FINISHED":
        return "a terminé";
      case "DROPPED":
        return "a abandonné";
      case "REWATCHED":
        return "a relancé";
      case "FAVORITED":
        return "a mis en favori";
      case "REVIEWED":
        return "a noté";
      case "PROGRESS":
        return e.count > 1 ? `a avancé (${e.count})` : "a avancé dans";
      case "LIST_CREATED":
        return "a créé une liste";
      case "LIST_ITEM_ADDED":
        return e.count > 1
          ? `a ajouté ${e.count} œuvres à une liste`
          : "a ajouté une œuvre à une liste";
      case "LIST_SHARED":
        return "a partagé une liste";
      default:
        return "a mis à jour";
    }
  }

  const rating = $derived(
    event.type === "REVIEWED" && typeof event.data.rating === "number"
      ? event.data.rating
      : null,
  );
</script>

<li class="card flex items-center gap-3 p-3">
  <a href="/u/{event.actor.username}" class="shrink-0">
    <Avatar seed={event.actor.username} size={36} />
  </a>

  <div class="min-w-0 flex-1">
    <p class="text-sm leading-snug">
      <a href="/u/{event.actor.username}" class="font-semibold hover:underline">
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
