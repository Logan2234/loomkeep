<script lang="ts">
  // The compact shell's fixed Notifications tab, beside Messages: it opens
  // the notifications page. Its badge counts as the desktop bell's does,
  // from the same cache entries.
  import { page } from "$app/state";
  import { keys } from "#lib/api/keys.js";
  import { getNotificationCounts } from "#lib/api/notifications.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getFollowRequests } from "#lib/api/social.js";
  import Icon from "#lib/components/Icon.svelte";
  import { m } from "#lib/paraglide/messages.js";

  let {
    slotClass = "h-9 w-9",
    // The filmstrip skin lays its tabs out as a horizontal scroller of
    // fixed-width chips, not flex-1 columns, so the wrapper is overridable.
    rootClass = "flex flex-1 flex-col items-center gap-1 text-[0.62rem]",
  }: { slotClass?: string; rootClass?: string } = $props();

  const countsQuery = createApiQuery(() => ({
    key: keys.notifications.counts(),
    fetch: getNotificationCounts,
  }));
  const requestsQuery = createApiQuery(() => ({
    key: keys.social.followRequests(),
    fetch: getFollowRequests,
  }));
  const badge = $derived(
    (countsQuery.data?.unseen ?? 0) + (requestsQuery.data?.length ?? 0),
  );
  const active = $derived(page.url.pathname === "/app/notifications");
</script>

<a
  href="/app/notifications"
  aria-current={active ? "page" : undefined}
  aria-label={m.common_notifications()}
  class="min-w-0 font-semibold transition-colors duration-150 {active
    ? 'text-accent'
    : 'text-dim'} {rootClass}">
  <span class="relative grid place-items-center rounded-full {slotClass}">
    <Icon name="bell" class="h-5 w-5" />
    {#if badge > 0}
      <span
        class="bg-accent text-accent-fg ring-surface absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.6rem] font-bold ring-2">
        {badge > 9 ? "9+" : badge}
      </span>
    {/if}
  </span>
  <span class="w-full truncate px-0.5 max-[359px]:sr-only">
    {m.nav_notifications_short()}
  </span>
</a>
