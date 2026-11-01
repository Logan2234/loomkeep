<script lang="ts">
  // The compact shell's fixed Messages tab, beside Notifications.
  import { getChatUnread } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import NavTab, {
    type NavTabLook,
  } from "#lib/components/sidebars/NavTab.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { m } from "#lib/paraglide/messages.js";

  let { look }: { look?: NavTabLook } = $props();

  const unreadQuery = createApiQuery(() => ({
    key: keys.chat.unread(),
    fetch: getChatUnread,
  }));
  const unread = $derived(
    (unreadQuery.data?.count ?? 0) + (unreadQuery.data?.works ?? 0),
  );
</script>

<NavTab
  icon="message"
  label={m.chat_title()}
  ariaLabel={unread ? m.chat_open_unread({ count: unread }) : m.chat_title()}
  active={chat.open}
  {look}
  onclick={() => chat.show()}>
  {#snippet badge()}
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
  {/snippet}
</NavTab>
