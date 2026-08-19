<script lang="ts">
  import { getFeed } from "$lib/api/client";
  import ActivityItem from "$lib/components/ActivityItem.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ActivityEventDto } from "@loomkeep/shared";

  let events = $state<ActivityEventDto[]>([]);
  let cursor = $state<string | null>(null);
  let loading = $state(true);
  let loadingMore = $state(false);

  $effect(() => {
    getFeed()
      .then((f) => {
        events = f.events;
        cursor = f.nextCursor;
      })
      .finally(() => (loading = false));
  });

  async function loadMore() {
    if (!cursor || loadingMore) return;
    loadingMore = true;
    try {
      const f = await getFeed(cursor);
      events = [...events, ...f.events];
      cursor = f.nextCursor;
    } finally {
      loadingMore = false;
    }
  }
</script>

<div class="mx-auto max-w-2xl px-4 py-6 md:py-8">
  <PageHeader
    icon="users"
    title="Fil d'activité"
    subtitle="Ce que font les membres que vous suivez." />

  {#if loading}
    <CardRowSkeleton count={6} />
  {:else if events.length === 0}
    <EmptyState>
      <p class="font-display text-lg font-bold">
        Rien à afficher pour l'instant
      </p>
      <p class="mt-1 text-sm">
        Partagez votre profil pour que d'autres vous suivent, ou suivez
        quelqu'un pour voir son activité ici.
      </p>
      <a href="/app/settings" class="btn btn-ghost mt-3">Partager mon profil</a>
    </EmptyState>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each events as event (event.id)}
        <ActivityItem {event} />
      {/each}
    </ul>

    {#if cursor}
      <div class="mt-4 flex justify-center">
        <button class="btn btn-ghost" disabled={loadingMore} onclick={loadMore}>
          {loadingMore ? m.common_loading() : m.common_see_more()}
        </button>
      </div>
    {/if}
  {/if}
</div>
