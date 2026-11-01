<script lang="ts">
  // The compact shell's fixed Notifications tab, beside Messages: it opens
  // the notifications page. Its badge counts as the desktop bell's does,
  // from the same cache entries.
  import { page } from "$app/state";
  import { keys } from "#lib/api/keys.js";
  import { getNotificationCounts } from "#lib/api/notifications.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getFollowRequests } from "#lib/api/social.js";
  import { m } from "#lib/paraglide/messages.js";
  import NavTab, { type NavTabLook } from "./NavTab.svelte";

  let { look }: { look?: NavTabLook } = $props();

  const countsQuery = createApiQuery(() => ({
    key: keys.notifications.counts(),
    fetch: getNotificationCounts,
  }));
  const requestsQuery = createApiQuery(() => ({
    key: keys.social.followRequests(),
    fetch: getFollowRequests,
  }));
  const count = $derived(
    (countsQuery.data?.unseen ?? 0) + (requestsQuery.data?.length ?? 0),
  );
  const active = $derived(page.url.pathname === "/app/notifications");
</script>

<NavTab
  href="/app/notifications"
  icon="bell"
  label={m.nav_notifications_short()}
  ariaLabel={m.common_notifications()}
  {active}
  {look}>
  {#snippet badge()}
    {#if count > 0}
      <span
        class="bg-accent text-accent-fg ring-surface absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.6rem] font-bold ring-2">
        {count > 9 ? "9+" : count}
      </span>
    {/if}
  {/snippet}
</NavTab>
