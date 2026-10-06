<script lang="ts">
  // The compact shell's fixed Messages tab, beside Notifications.
  import { getChatUnread } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { m } from "#lib/paraglide/messages.js";

  let {
    slotClass = "h-9 w-9",
    rootClass = "flex flex-1 flex-col items-center gap-1 text-[0.62rem]",
  }: { slotClass?: string; rootClass?: string } = $props();

  const unreadQuery = createApiQuery(() => ({
    key: keys.chat.unread(),
    fetch: getChatUnread,
  }));
  const unread = $derived(unreadQuery.data?.count ?? 0);
</script>

<button
  type="button"
  onclick={() => chat.show()}
  aria-label={unread ? m.chat_open_unread({ count: unread }) : m.chat_title()}
  class="min-w-0 font-semibold {chat.open
    ? 'text-accent'
    : 'text-dim'} {rootClass}">
  <span class="relative grid place-items-center rounded-full {slotClass}">
    <Icon name="message" class="h-5 w-5" />
    {#if unread > 0}
      <span
        class="bg-accent text-accent-fg ring-surface absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.6rem] font-bold ring-2">
        {unread > 9 ? "9+" : unread}
      </span>
    {:else if isFeatureNew("messages")}
      <span
        class="bg-accent ring-surface absolute top-0 right-0 h-2 w-2 rounded-full ring-2"
        aria-hidden="true"></span>
    {/if}
  </span>
  <span class="w-full truncate px-0.5 max-[359px]:sr-only">
    {m.chat_title()}
  </span>
</button>
