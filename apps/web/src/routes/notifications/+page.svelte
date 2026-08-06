<script lang="ts">
  import {
    acceptFollowRequest,
    getFollowRequests,
    rejectFollowRequest,
  } from "$lib/api/social";
  import Avatar from "$lib/components/Avatar.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { notifications } from "$lib/notifications.svelte";
  import type { FollowRequestDto, NotificationDto } from "@loomkeep/shared";
  import { onMount } from "svelte";

  let loading = $state(true);
  let requests = $state<FollowRequestDto[]>([]);
  let busy = $state<string | null>(null);

  $effect(() => {
    void getFollowRequests().then((r) => (requests = r));
  });

  async function accept(req: FollowRequestDto) {
    busy = req.id;
    try {
      await acceptFollowRequest(req.id);
      requests = requests.filter((r) => r.id !== req.id);
    } finally {
      busy = null;
    }
  }

  async function reject(req: FollowRequestDto) {
    busy = req.id;
    try {
      await rejectFollowRequest(req.id);
      requests = requests.filter((r) => r.id !== req.id);
    } finally {
      busy = null;
    }
  }
  onMount(async () => {
    await notifications.refresh(true); // scan for new episodes, then list
    loading = false;
  });

  const relFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
  });

  // Social kinds render the actor's avatar; everything else a bell.
  const isSocial = (n: NotificationDto) => n.type.startsWith("FOLLOW");
  const actorSeed = (n: NotificationDto) =>
    typeof n.data.actorUsername === "string" ? n.data.actorUsername : "";
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader icon="bell" title="Notifications" class="mb-6">
    {#snippet actions()}
      {#if notifications.unread > 0}
        <button
          class="link-accent text-sm"
          onclick={() => notifications.markAllRead()}>
          Tout marquer comme lu
        </button>
      {/if}
    {/snippet}
  </PageHeader>

  {#if requests.length > 0}
    <section class="mb-6">
      <h2 class="text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
        Demandes de suivi
      </h2>
      <ul class="space-y-2">
        {#each requests as req (req.id)}
          <li class="card flex items-center gap-3 p-3">
            <a href="/u/{req.user.username}">
              <Avatar seed={req.user.username} size={40} />
            </a>
            <div class="min-w-0 flex-1">
              <a
                href="/u/{req.user.username}"
                class="block truncate font-semibold hover:underline">
                {req.user.displayName}
              </a>
              <p class="timecode truncate text-xs">@{req.user.username}</p>
            </div>
            <button
              class="btn btn-primary"
              disabled={busy === req.id}
              onclick={() => accept(req)}>
              Accepter
            </button>
            <button
              class="btn btn-ghost"
              disabled={busy === req.id}
              onclick={() => reject(req)}>
              Refuser
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if loading}
    <CardRowSkeleton count={5} />
  {:else if notifications.items.length === 0}
    <EmptyState>
      Rien de neuf. Les nouveaux épisodes de tes séries suivies et l'activité de
      ta communauté apparaîtront ici.
    </EmptyState>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each notifications.items as n (n.id)}
        <li>
          {#if n.url}
            <a
              href={n.url}
              onclick={() => notifications.markRead(n.id)}
              class="card hover:border-accent flex items-center gap-3 p-3 transition-[border-color] {n.read
                ? ''
                : 'border-accent/50'}">
              {@render row(n)}
            </a>
          {:else}
            <div
              class="card flex items-center gap-3 p-3 {n.read
                ? ''
                : 'border-accent/50'}">
              {@render row(n)}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#snippet row(n: NotificationDto)}
  {#if isSocial(n)}
    <Avatar seed={actorSeed(n)} size={36} />
  {:else}
    <span
      class="bg-surface-2 text-accent grid h-9 w-9 shrink-0 place-items-center rounded-xl">
      <Icon name="bell" class="h-5 w-5" />
    </span>
  {/if}
  <div class="min-w-0 flex-1">
    <p class="truncate text-sm">
      <span class="font-semibold">{n.title}</span>
      {#if n.body}
        <span class="text-dim"> · {n.body}</span>
      {/if}
    </p>
  </div>
  <span class="timecode shrink-0 text-xs">
    {relFmt.format(new Date(n.timestamp))}
  </span>
  {#if !n.read}
    <span class="bg-accent h-2 w-2 shrink-0 rounded-full"></span>
  {/if}
{/snippet}
