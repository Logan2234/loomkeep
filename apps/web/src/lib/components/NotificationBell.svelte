<script lang="ts">
  // Global notification bell, mounted once in the root layout (same idiom as
  // Toast) — a fixed corner affordance rather than a dedicated /notifications
  // page. Two independent lists share the panel: live pending follow requests
  // (the actionable `Follow` rows, via /social/requests) and the bell feed
  // (follow/comment activity — episodes stay push/email-only, see the API's
  // NotificationService). Reading an item deletes it: there's no dimmed
  // "read" state, a row's presence *is* the unread signal.
  //
  // Desktop docks it top-right (the rail owns the left edge, so the corner is
  // free). Mobile docks it bottom-right instead, just above the fixed tab bar
  // — the bottom is already where every other mobile control lives (tab bar,
  // Menu launcher sheet), and it keeps the button in thumb reach. Opening it
  // there rises a Drawer bottom sheet instead of a dropdown, matching the
  // Menu launcher's own pattern.
  import { fade, slide } from "svelte/transition";
  import {
    acceptFollowRequest,
    getFollowRequests,
    rejectFollowRequest,
  } from "$lib/api/social";
  import type { FollowRequestDto, NotificationDto } from "@loomkeep/shared";
  import Avatar from "./Avatar.svelte";
  import Drawer from "./Drawer.svelte";
  import Icon from "./Icon.svelte";
  import { notifications } from "$lib/notifications.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let open = $state(false);
  let requests = $state<FollowRequestDto[]>([]);
  let requestsLoaded = $state(false);
  let busy = $state<string | null>(null);
  let panelEl = $state<HTMLDivElement | null>(null);
  let drawerContentEl = $state<HTMLDivElement | null>(null);
  let buttonEl = $state<HTMLButtonElement | null>(null);

  const total = $derived(requests.length + notifications.unread);

  async function toggle() {
    open = !open;
    if (open && !requestsLoaded) {
      requestsLoaded = true;
      requests = await getFollowRequests().catch(() => []);
    }
  }

  function close() {
    open = false;
  }

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

  function onItemClick(n: NotificationDto) {
    void notifications.markRead(n.id);
    if (!n.url) close();
  }

  const relFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
  });

  const isSocial = (n: NotificationDto) => n.type.startsWith("FOLLOW");
  const actorSeed = (n: NotificationDto) =>
    typeof n.data.actorUsername === "string" ? n.data.actorUsername : "";

  // Desktop-only: the dropdown closes on an outside click/Escape. The mobile
  // Drawer handles both itself (backdrop tap, swipe, Escape) — this must not
  // also fire for taps inside it, or every tap in the sheet would instantly
  // close it before its own handlers run.
  $effect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        panelEl?.contains(target) ||
        drawerContentEl?.contains(target) ||
        buttonEl?.contains(target)
      ) {
        return;
      }
      close();
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeydown);
    };
  });
</script>

<div
  class="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)] z-40 md:top-4 md:right-4 md:bottom-auto">
  <button
    bind:this={buttonEl}
    type="button"
    onclick={toggle}
    aria-label={m.notif_title()}
    aria-expanded={open}
    class="border-border bg-surface/90 hover:border-accent/40 relative grid h-11 w-11 place-items-center rounded-full border shadow-lg backdrop-blur transition-colors md:shadow-sm">
    <Icon
      name="bell"
      class="h-5 w-5 {open ? 'text-accent' : 'text-dim'} transition-colors" />
    {#if total > 0}
      <span
        class="bg-accent text-accent-fg ring-surface absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.65rem] font-bold ring-2">
        {total > 9 ? "9+" : total}
      </span>
    {/if}
  </button>

  {#if open}
    <!-- Desktop dropdown -->
    <div
      bind:this={panelEl}
      transition:fade={{ duration: 120 }}
      role="dialog"
      aria-label={m.notif_title()}
      class="border-border bg-surface absolute top-[calc(100%+0.5rem)] right-0 hidden max-h-[min(32rem,80vh)] w-[min(23rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border shadow-xl md:flex">
      {@render content()}
    </div>
  {/if}
</div>

{#if open}
  <!-- Mobile bottom sheet -->
  <Drawer onclose={close} labelledby="notif-drawer-title">
    <div
      bind:this={drawerContentEl}
      class="flex min-h-0 flex-1 flex-col overflow-hidden">
      {@render content()}
    </div>
  </Drawer>
{/if}

{#snippet content()}
  <header
    class="border-border flex items-center justify-between border-b px-4 py-3">
    <h2 id="notif-drawer-title" class="font-display text-base font-bold">
      {m.notif_title()}
    </h2>
    {#if notifications.items.length > 0}
      <button
        type="button"
        class="link-accent text-xs font-semibold"
        onclick={() => notifications.markAllRead()}>
        {m.notif_clear_all()}
      </button>
    {/if}
  </header>

  <div data-drawer-scroll class="flex-1 touch-pan-y overflow-y-auto">
    {#if requests.length > 0}
      <div class="px-4 pt-3 pb-1">
        <span
          class="timecode text-[0.65rem] font-bold tracking-[0.14em] uppercase">
          {m.notif_follow_requests()}
        </span>
      </div>
      <ul>
        {#each requests as req (req.id)}
          <li
            transition:slide={{ duration: 150 }}
            class="flex items-center gap-3 px-4 py-2.5">
            <a href="/app/u/{req.user.username}" onclick={close}>
              <Avatar
                seed={req.user.username}
                url={req.user.avatarUrl}
                size={36} />
            </a>
            <div class="min-w-0 flex-1">
              <a
                href="/app/u/{req.user.username}"
                onclick={close}
                class="block truncate text-sm font-semibold hover:underline">
                {req.user.displayName}
              </a>
              <p class="timecode truncate text-xs">@{req.user.username}</p>
            </div>
            <button
              type="button"
              aria-label={m.notif_accept()}
              disabled={busy === req.id}
              onclick={() => accept(req)}
              class="bg-accent text-accent-fg grid h-8 w-8 shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-50">
              <Icon name="check" class="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={m.notif_reject()}
              disabled={busy === req.id}
              onclick={() => reject(req)}
              class="text-dim hover:text-fg hover:bg-surface-2 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-50">
              <Icon name="x" class="h-4 w-4" />
            </button>
          </li>
        {/each}
      </ul>
      <div class="border-border mx-4 my-2 border-t" aria-hidden="true"></div>
    {/if}

    {#if notifications.items.length === 0 && requests.length === 0}
      <p class="text-dim px-4 py-10 text-center text-sm">
        {m.notif_empty()}
      </p>
    {:else if notifications.items.length > 0}
      <ul>
        {#each notifications.items as n (n.id)}
          <li transition:slide={{ duration: 150 }}>
            {#if n.url}
              <a
                href={n.url}
                onclick={() => onItemClick(n)}
                class="hover:bg-surface-2 flex items-center gap-3 px-4 py-2.5 transition-colors">
                {@render row(n)}
              </a>
            {:else}
              <div class="flex items-center gap-3 px-4 py-2.5">
                {@render row(n)}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

{#snippet row(n: NotificationDto)}
  {#if isSocial(n)}
    <Avatar seed={actorSeed(n)} size={32} />
  {:else}
    <span
      class="bg-surface-2 text-accent grid h-8 w-8 shrink-0 place-items-center rounded-xl">
      <Icon name="bell" class="h-4 w-4" />
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
  <span class="timecode shrink-0 text-[0.65rem]">
    {relFmt.format(new Date(n.timestamp))}
  </span>
{/snippet}
