<script lang="ts">
  // The Messages launcher, beside the feedback one in the bottom-right
  // corner — in its place when the instance or the account has none. Both
  // step aside together (see cornerLaunchersHidden).
  import { page } from "$app/state";
  import { getChatUnread } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import {
    cornerLaunchersHidden,
    feedbackLauncherWanted,
  } from "#lib/corner-launchers.svelte.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { scale } from "svelte/transition";
  import ChatPanel from "./ChatPanel.svelte";

  const reduced = prefersReducedMotion();

  const unreadQuery = createApiQuery(() => ({
    key: keys.chat.unread(),
    fetch: getChatUnread,
  }));
  const unread = $derived(unreadQuery.data?.count ?? 0);

  // The full-screen page is Messages already.
  const onMessagesPage = $derived(
    page.url.pathname.startsWith("/app/messages"),
  );
  const shown = $derived(!onMessagesPage && !cornerLaunchersHidden());
</script>

{#if chat.open && !onMessagesPage}
  <ChatPanel />
{/if}

{#if shown}
  <button
    type="button"
    transition:scale={{ duration: reduced ? 0 : 150, start: 0.9 }}
    class="bg-btn text-btn-fg fixed bottom-[26px] z-40 grid h-12 w-12 place-items-center rounded-full shadow-[0_6px_18px_rgb(0_0_0/0.35)] transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none
      {feedbackLauncherWanted() ? 'right-[86px]' : 'right-[26px]'}"
    aria-label={chat.open
      ? m.chat_close()
      : unread
        ? m.chat_open_unread({ count: unread })
        : m.chat_title()}
    aria-expanded={chat.open}
    onclick={() => (chat.open ? chat.close() : chat.show())}>
    <Icon name={chat.open ? "chevron-down" : "message"} class="h-5.5 w-5.5" />
    {#if !chat.open && unread > 0}
      <span
        class="bg-danger ring-bg absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-[0.68rem] font-bold text-white ring-2">
        {unread > 99 ? "99+" : unread}
      </span>
    {:else if !chat.open && isFeatureNew("messages")}
      <span
        class="bg-accent ring-bg absolute top-0 right-0 h-2.5 w-2.5 rounded-full ring-2"
        aria-hidden="true"></span>
    {/if}
  </button>
{/if}
