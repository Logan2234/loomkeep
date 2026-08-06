<script lang="ts">
  import { getUserActivity } from "$lib/api/client";
  import ActivityItem from "$lib/components/ActivityItem.svelte";
  import type { ActivityEventDto } from "@loomkeep/shared";

  // A user's recent activity timeline, shown under their profile stats. Loads
  // its own data (visibility-filtered server-side) and hides when empty.
  let { username }: { username: string } = $props();

  let events = $state<ActivityEventDto[]>([]);
  let cursor = $state<string | null>(null);
  let loaded = $state(false);
  let loadingMore = $state(false);

  $effect(() => {
    const name = username;
    loaded = false;
    events = [];
    cursor = null;
    getUserActivity(name)
      .then((f) => {
        events = f.events;
        cursor = f.nextCursor;
      })
      .catch(() => (events = []))
      .finally(() => (loaded = true));
  });

  async function loadMore() {
    if (!cursor || loadingMore) return;
    loadingMore = true;
    try {
      const f = await getUserActivity(username, cursor);
      events = [...events, ...f.events];
      cursor = f.nextCursor;
    } finally {
      loadingMore = false;
    }
  }
</script>

{#if loaded && events.length > 0}
  <section class="mt-6">
    <h2 class="timecode mb-3 text-[0.62rem] tracking-[0.18em] uppercase">
      Activité récente
    </h2>
    <ul class="flex flex-col gap-2">
      {#each events as event (event.id)}
        <ActivityItem {event} />
      {/each}
    </ul>
    {#if cursor}
      <div class="mt-3 flex justify-center">
        <button
          class="btn btn-ghost btn-sm"
          disabled={loadingMore}
          onclick={loadMore}>
          {loadingMore ? "Chargement…" : "Voir plus"}
        </button>
      </div>
    {/if}
  </section>
{/if}
