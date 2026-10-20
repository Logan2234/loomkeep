<script lang="ts">
  // Mounted once in the app layout. On desktop it's the bell in the top-right
  // corner (the rail owns the left edge): a panel with the follow requests
  // and the latest entries, and a way to the full history. The compact shell
  // has no bell of its own — BottomNavigation's tab leads to the
  // notifications page — but what keeps the badges right lives here for
  // both: live refreshes, a push opened from the system tray, and the
  // installed app's icon badge.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getChatUnread } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import {
    getNotificationCounts,
    getNotificationHistory,
  } from "#lib/api/notifications.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getFollowRequests } from "#lib/api/social.js";
  import { appConfig } from "#lib/config.svelte.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { notificationActions } from "#lib/notifications/actions.svelte.js";
  import { showAppBadge } from "#lib/notifications/app-badge.js";
  import {
    glow,
    panelIn,
    panelOut,
    rowIn,
    rowOut,
  } from "#lib/notifications/transitions.js";
  import { m } from "#lib/paraglide/messages.js";
  import { onRealtimeEvent } from "#lib/realtime/socket.js";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { fade, scale } from "svelte/transition";
  import Icon from "./Icon.svelte";
  import NewBadge from "./NewBadge.svelte";
  import FollowRequests from "./notifications/FollowRequests.svelte";
  import NotificationRow from "./notifications/NotificationRow.svelte";

  /** How many of the latest entries the bell shows; the page has the rest. */
  const PREVIEW_SIZE = 8;

  const queryClient = useQueryClient();
  const actions = notificationActions(queryClient);
  const reduced = prefersReducedMotion();
  /** What came after this lit up as it arrives; what was there doesn't. */
  const mountedAt = new Date().toISOString();

  let open = $state(false);
  /** Lines the rows up one after the other, on opening only. */
  let opening = $state(false);
  let panelEl = $state<HTMLDivElement | null>(null);
  let buttonEl = $state<HTMLButtonElement | null>(null);

  const countsQuery = createApiQuery(() => ({
    key: keys.notifications.counts(),
    fetch: getNotificationCounts,
  }));
  const previewQuery = createApiQuery(() => ({
    key: keys.notifications.preview(),
    fetch: () => getNotificationHistory(1, { limit: PREVIEW_SIZE }),
    enabled: !layout.compact,
  }));
  const requestsQuery = createApiQuery(() => ({
    key: keys.social.followRequests(),
    fetch: getFollowRequests,
  }));
  const chatUnreadQuery = createApiQuery(() => ({
    key: keys.chat.unread(),
    fetch: getChatUnread,
    enabled: appConfig.chatEnabled,
  }));

  const entries = $derived(previewQuery.data?.items ?? []);
  const requests = $derived(requestsQuery.data ?? []);
  const unread = $derived(countsQuery.data?.unread ?? 0);
  const badge = $derived((countsQuery.data?.unseen ?? 0) + requests.length);

  $effect(() =>
    onRealtimeEvent("notification", () => {
      // Arriving in front of the reader, it's seen: the counts refresh once
      // that's recorded rather than showing it for a moment.
      const onScreen = open || page.url.pathname === "/app/notifications";
      void queryClient.invalidateQueries({
        queryKey: keys.notifications.entries(),
        predicate: (query) => !onScreen || query.queryKey[2] !== "counts",
      });
      if (onScreen) actions.seen();
    }),
  );

  let lastBadge: number | null = null;
  $effect(() => {
    if (!countsQuery.data || !requestsQuery.data) return;
    if (lastBadge !== null && badge > lastBadge) glow(buttonEl);
    lastBadge = badge;
  });
  $effect(() =>
    onRealtimeEvent("follow-request-changed", () => {
      void queryClient.invalidateQueries({
        queryKey: keys.social.followRequests(),
      });
    }),
  );

  // What the icon shows matches the bell and the Messages tab together.
  $effect(() => {
    const chat = appConfig.chatEnabled
      ? (chatUnreadQuery.data?.count ?? 0) + (chatUnreadQuery.data?.works ?? 0)
      : 0;
    showAppBadge(badge + chat);
  });

  // A push opened from the system tray lands with its entry's id, set by
  // the service worker: that entry is read now.
  $effect(() => {
    const id = page.url.searchParams.get("notification");
    if (!id) return;
    actions.openedFromPush(id);
    const url = new URL(page.url.href);
    url.searchParams.delete("notification");
    void goto(url, { replace: true, reset: false });
  });

  function toggle() {
    if (open) return close();
    open = true;
    opening = true;
    setTimeout(() => (opening = false), reduced ? 0 : 450);
    actions.seen();
  }

  function close() {
    open = false;
  }

  // Closes on an outside click or Escape.
  $effect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelEl?.contains(target) || buttonEl?.contains(target)) return;
      close();
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key !== "Escape" || document.querySelector("[role=menu]")) return;
      close();
      buttonEl?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeydown);
    };
  });
</script>

{#if !layout.compact}
  <div class="fixed top-4 right-4 z-40">
    <button
      bind:this={buttonEl}
      type="button"
      onclick={toggle}
      aria-label={m.common_notifications()}
      aria-expanded={open}
      class="border-border bg-surface/90 hover:border-accent/40 relative grid h-11 w-11 place-items-center rounded-full border shadow-sm backdrop-blur transition-[border-color,background-color,scale] duration-150 active:scale-95 motion-reduce:transition-none {open
        ? 'border-accent/40 bg-surface'
        : ''}">
      <Icon
        name="bell"
        class="h-5 w-5 {open
          ? 'text-accent'
          : 'text-dim'} transition-colors duration-150" />
      {#if badge > 0}
        {#key badge}
          <!-- Keyed on the count so the badge pops on every change. -->
          <span
            in:scale={{ duration: reduced ? 0 : 200, start: 0.95 }}
            out:fade={{ duration: reduced ? 0 : 150 }}
            class="bg-accent text-accent-fg ring-surface absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.65rem] font-bold ring-2">
            {badge > 9 ? "9+" : badge}
          </span>
        {/key}
      {/if}
    </button>

    {#if open}
      <div
        bind:this={panelEl}
        in:panelIn
        out:panelOut
        role="dialog"
        aria-label={m.common_notifications()}
        class="border-border bg-surface absolute top-[calc(100%+0.5rem)] right-0 flex max-h-[min(34rem,80svh)] w-[min(25rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border shadow-xl"
        class:bell-opening={opening}>
        <header
          class="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
          <h2 class="font-display text-base font-bold">
            {m.common_notifications()}
          </h2>
          {#if unread > 0}
            <button
              type="button"
              transition:fade={{ duration: reduced ? 0 : 150 }}
              class="link-accent inline-flex items-center gap-1 text-xs"
              onclick={() => actions.readAll(entries.length)}>
              <Icon name="check-check" class="h-3.5 w-3.5" />
              {m.notif_mark_all_read()}
            </button>
          {/if}
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto pb-1">
          {#if requests.length > 0}
            <h3 class="section-label">{m.notif_follow_requests()}</h3>
            <FollowRequests {requests} onopen={close} />
          {/if}

          {#if entries.length > 0}
            {#if requests.length > 0}
              <h3 class="section-label">{m.notif_recent()}</h3>
            {/if}
            <ul>
              {#each entries as entry, i (entry.id)}
                <li
                  in:rowIn={{ flash: entry.createdAt > mountedAt }}
                  out:rowOut
                  class="bell-row"
                  style:--i={i}>
                  <NotificationRow
                    {entry}
                    index={i}
                    onread={actions.read}
                    onunread={actions.unread}
                    onremove={actions.remove}
                    onopen={close} />
                </li>
              {/each}
            </ul>
          {:else if requests.length === 0 && previewQuery.data}
            <div
              class="text-dim flex flex-col items-center gap-2 px-6 py-9 text-center text-sm">
              <span
                class="bg-surface-2 grid h-11 w-11 place-items-center rounded-full">
                <Icon name="bell" class="h-5 w-5" />
              </span>
              <b class="font-display text-fg text-base">
                {m.notif_empty_title()}
              </b>
              {m.notif_empty()}
            </div>
          {/if}
        </div>

        <a
          href="/app/notifications"
          onclick={close}
          class="border-border hover:bg-surface-2 hover:text-accent group flex items-center justify-center gap-1.5 border-t px-4 py-2.5 text-sm font-semibold transition-colors duration-150">
          {m.notif_see_all()}
          {#if isFeatureNew("notification-history")}<NewBadge />{/if}
          <Icon
            name="chevron-right"
            class="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </a>
      </div>
    {/if}
  </div>
{/if}

<style>
  .section-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-dim);
  }
  .section-label::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }
  /* On opening, the rows come in one after the other. */
  .bell-opening .bell-row {
    animation: bell-row-in 240ms ease-out backwards;
    animation-delay: calc(60ms + var(--i) * 22ms);
  }
  @keyframes bell-row-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bell-opening .bell-row {
      animation: none;
    }
  }
</style>
