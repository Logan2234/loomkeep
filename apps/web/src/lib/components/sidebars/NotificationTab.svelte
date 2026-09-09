<script lang="ts">
  // The bell as a tab in the mobile bars, shared by the three skins. It used
  // to be a fixed button floating above the bar (NotificationBell), which
  // covered page content on every screen since nothing reserved space for
  // it.
  //
  // NotificationBell still owns the sheet and the follow-request list; this
  // only needs the unread count and asks it to open, the same CustomEvent
  // idiom MenuSheet uses. Reading the same query key means TanStack serves
  // both from one cache entry and one poll.
  import { getNotifications } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let {
    slotClass = "h-9 w-9",
    // The filmstrip skin lays its tabs out as a horizontal scroller of
    // fixed-width chips, not flex-1 columns, so the wrapper is overridable.
    rootClass = "flex flex-1 flex-col items-center gap-1 text-[0.62rem]",
  }: { slotClass?: string; rootClass?: string } = $props();

  const feedQuery = createApiQuery(() => ({
    key: keys.notifications.feed(),
    fetch: getNotifications,
  }));
  const unread = $derived(feedQuery.data?.unread ?? 0);

  function open() {
    dispatchEvent(new CustomEvent("mobile-notifications-toggle"));
  }
</script>

<button
  type="button"
  onclick={open}
  aria-label={m.common_notifications()}
  class="text-dim font-semibold {rootClass}">
  <span class="relative grid place-items-center rounded-full {slotClass}">
    <Icon name="bell" class="h-5 w-5" />
    {#if unread > 0}
      <span
        class="bg-accent text-accent-fg ring-surface absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.6rem] font-bold ring-2">
        {unread > 9 ? "9+" : unread}
      </span>
    {/if}
  </span>
  {m.nav_notifications_short()}
</button>
