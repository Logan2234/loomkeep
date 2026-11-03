<script lang="ts">
  // Alerts and Messages on a phone: a tab peeking from the edge of the
  // screen, its badge counting both. A tap fans the two out. It opens on a
  // tap, never a swipe: a swipe in from the edge is Android's back gesture.
  // A long press lifts it, to drop it anywhere along either edge — the place
  // is remembered on this phone. It tucks itself away while the page
  // scrolls down, and comes back when it scrolls up or stops.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getChatUnread } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { getNotificationCounts } from "#lib/api/notifications.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getFollowRequests } from "#lib/api/social.js";
  import { portal } from "#lib/actions/portal.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { fanBurst } from "#lib/library-fan.js";
  import { EDGE_TAB_Y, mobileNav } from "#lib/mobile-nav.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import { fade } from "svelte/transition";

  const reduced = prefersReducedMotion();
  const LIFT_MS = 450;
  /** A finger moving further than this before the lift is scrolling, not pressing. */
  const SLOP = 8;
  const IDLE_SHOW_MS = 900;
  /** How far the two actions sit from the tab's centre. */
  const ACTION_X = 96;
  const ACTION_Y = 52;

  const countsQuery = createApiQuery(() => ({
    key: keys.notifications.counts(),
    fetch: getNotificationCounts,
  }));
  const requestsQuery = createApiQuery(() => ({
    key: keys.social.followRequests(),
    fetch: getFollowRequests,
  }));
  const chatQuery = createApiQuery(() => ({
    key: keys.chat.unread(),
    fetch: getChatUnread,
    enabled: appConfig.chatEnabled,
  }));
  const alerts = $derived(
    (countsQuery.data?.unseen ?? 0) + (requestsQuery.data?.length ?? 0),
  );
  const messages = $derived(
    appConfig.chatEnabled
      ? (chatQuery.data?.count ?? 0) + (chatQuery.data?.works ?? 0)
      : 0,
  );
  const unread = $derived(alerts + messages);
  const shortCount = (count: number) => (count > 9 ? "9+" : String(count));

  const place = $derived(mobileNav.edgeTab);
  const right = $derived(place.side === "right");

  let open = $state(false);
  let tucked = $state(false);
  let lifted = $state<{ x: number; y: number } | null>(null);
  let centre = $state({ x: 0, y: 0 });

  let press: { x: number; y: number; id: number; moved: boolean } | null = null;
  let liftTimer: ReturnType<typeof setTimeout> | undefined;
  let swallowClick = false;

  const actions = $derived<
    {
      id: string;
      label: string;
      icon: IconName;
      count: number;
      href?: string;
      dy: number;
    }[]
  >([
    {
      id: "alerts",
      label: m.nav_notifications_short(),
      icon: "bell",
      count: alerts,
      href: "/app/notifications",
      dy: -ACTION_Y,
    },
    {
      id: "messages",
      label: m.chat_title(),
      icon: "message",
      count: messages,
      dy: ACTION_Y,
    },
  ]);

  $effect(() => {
    void page.url.pathname;
    open = false;
  });

  $effect(() => {
    let last = scrollY;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const y = scrollY;
      if (y > last + 6 && y > 40 && !open) tucked = true;
      else if (y < last - 6) tucked = false;
      last = y;
      clearTimeout(idle);
      idle = setTimeout(() => (tucked = false), IDLE_SHOW_MS);
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      removeEventListener("scroll", onScroll);
      clearTimeout(idle);
    };
  });

  function toggle(tab: HTMLElement) {
    if (!appConfig.chatEnabled) {
      void goto("/app/notifications");
      return;
    }
    if (open) {
      open = false;
      return;
    }
    const rect = tab.getBoundingClientRect();
    centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    tucked = false;
    open = true;
  }

  function onpointerdown(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    press = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      moved: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    clearTimeout(liftTimer);
    liftTimer = setTimeout(() => {
      if (!press || press.moved) return;
      open = false;
      lifted = { x: press.x, y: press.y };
    }, LIFT_MS);
  }

  function onpointermove(event: PointerEvent) {
    if (!press || event.pointerId !== press.id) return;
    if (lifted) {
      lifted = { x: event.clientX, y: event.clientY };
      return;
    }
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP) {
      press.moved = true;
      clearTimeout(liftTimer);
    }
  }

  function onpointerup(event: PointerEvent) {
    clearTimeout(liftTimer);
    if (!press || event.pointerId !== press.id) return;
    press = null;
    if (!lifted) return;
    const drop = lifted;
    lifted = null;
    mobileNav.placeEdgeTab({
      side: drop.x < innerWidth / 2 ? "left" : "right",
      y: Math.min(
        EDGE_TAB_Y.max,
        Math.max(EDGE_TAB_Y.min, drop.y / innerHeight),
      ),
    });
    swallowClick = true;
    setTimeout(() => (swallowClick = false));
  }

  function onpointercancel() {
    clearTimeout(liftTimer);
    press = null;
    lifted = null;
  }

  function onclick(event: MouseEvent) {
    if (swallowClick || press?.moved) return;
    toggle(event.currentTarget as HTMLElement);
  }

  function openMessages() {
    open = false;
    chat.show();
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (open && event.key === "Escape") open = false;
  }} />

<button
  type="button"
  aria-label={unread > 0
    ? m.nav_edge_tab_unread({ count: unread })
    : m.nav_edge_tab()}
  aria-expanded={appConfig.chatEnabled ? open : undefined}
  aria-controls={appConfig.chatEnabled ? "edge-tab-actions" : undefined}
  class="fixed z-[29] grid size-12 touch-none place-items-center rounded-full border shadow-lg transition-[translate,scale,background-color,color] duration-200 select-none motion-reduce:transition-none {open
    ? 'border-accent bg-accent text-accent-fg'
    : 'border-border bg-surface text-accent'} {lifted
    ? 'scale-110 shadow-2xl transition-none'
    : tucked
      ? right
        ? 'translate-x-6'
        : '-translate-x-6'
      : ''}"
  style={lifted
    ? `left: ${lifted.x - 24}px; top: ${lifted.y - 24}px`
    : `${right ? "right" : "left"}: -1.75rem; top: calc(${place.y * 100}% - 1.5rem)`}
  {onclick}
  {onpointerdown}
  {onpointermove}
  {onpointerup}
  {onpointercancel}>
  <Icon
    name="bell"
    class="absolute h-3.5 w-3.5 {lifted ? '' : right ? 'left-1' : 'right-1'}" />
  {#if unread > 0 && !open}
    <span
      class="bg-accent text-accent-fg ring-bg absolute -top-1.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full px-1 text-[0.6rem] font-bold ring-2 {right
        ? '-left-2.5'
        : '-right-2.5'}"
      aria-hidden="true">
      {shortCount(unread)}
    </span>
  {/if}
</button>

{#if open}
  <div use:portal class="contents">
    <button
      type="button"
      tabindex="-1"
      aria-label={m.common_close()}
      class="fixed inset-0 z-[28] bg-black/45"
      transition:fade|global={{ duration: reduced ? 0 : 180 }}
      onclick={() => (open = false)}></button>
    <ul id="edge-tab-actions" aria-label={m.nav_edge_tab()} class="contents">
      {#each actions as action, i (action.id)}
        {@const dx = right ? -ACTION_X : ACTION_X}
        <li class="contents">
          <svelte:element
            this={action.href ? "a" : "button"}
            href={action.href}
            type={action.href ? undefined : "button"}
            onclick={action.href ? () => (open = false) : openMessages}
            class="group fixed z-[31] flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 outline-none"
            style="left: {centre.x + dx}px; top: {centre.y + action.dy}px"
            in:fanBurst|global={{ dx, dy: action.dy, delay: i * 30, reduced }}
            out:fanBurst|global={{ dx, dy: action.dy, reduced }}>
            <span
              class="bg-surface border-border text-accent group-active:bg-accent group-active:text-accent-fg group-focus-visible:outline-accent relative grid size-14 place-items-center rounded-full border shadow-lg outline-offset-2 transition-colors duration-150 group-focus-visible:outline-2">
              <Icon name={action.icon} class="h-6 w-6" />
              {#if action.count > 0}
                <span
                  class="bg-accent text-accent-fg ring-surface absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.65rem] font-bold ring-2">
                  {shortCount(action.count)}
                </span>
              {/if}
            </span>
            <span
              class="text-xs font-bold whitespace-nowrap text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.75)]"
              >{action.label}</span>
          </svelte:element>
        </li>
      {/each}
    </ul>
  </div>
{/if}
