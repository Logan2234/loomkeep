<script lang="ts">
  import { chat } from "#lib/chat/chat.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { ConversationDto } from "@loomkeep/shared";
  import { scale } from "svelte/transition";
  import {
    conversationName,
    conversationPreview,
    conversationTime,
    shownUnread,
  } from "./conversation-presentation";

  let { conversations }: { conversations: ConversationDto[] } = $props();

  const reduced = prefersReducedMotion();
  let hovered = $state<{
    conversation: ConversationDto;
    top: number;
    left: number;
  } | null>(null);

  function hover(event: Event, conversation: ConversationDto) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    hovered = { conversation, top: box.top - 4, left: box.right + 12 };
  }

  const friendsTab = $derived(chat.tab === "friends");
</script>

<nav
  aria-label={m.chat_conversations()}
  class="bg-bg border-border flex w-[76px] shrink-0 flex-col items-center gap-1.5 overflow-x-hidden overflow-y-auto border-r py-2.5
    {chat.drawer ? '' : 'rounded-l-2xl'}">
  <button
    type="button"
    class="btn-icon"
    aria-label={m.chat_unfold_list()}
    title={m.chat_unfold_list()}
    aria-expanded={chat.drawer}
    onclick={() => (chat.drawer = true)}>
    <Icon name="chevron-left" class="h-4.5 w-4.5" />
  </button>

  <div
    role="tablist"
    aria-orientation="vertical"
    class="bg-surface flex flex-col gap-1 rounded-xl p-1">
    <button
      type="button"
      role="tab"
      aria-selected={friendsTab}
      aria-label={m.common_friends()}
      title={m.common_friends()}
      class="btn-icon {friendsTab ? 'bg-surface-2 text-fg' : ''}"
      onclick={() => (chat.tab = "friends")}>
      <Icon name="users" class="h-4.5 w-4.5" />
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={!friendsTab}
      aria-label={m.common_works()}
      title={m.common_works()}
      class="btn-icon {friendsTab ? '' : 'bg-surface-2 text-fg'}"
      onclick={() => (chat.tab = "works")}>
      <Icon name="tv" class="h-4.5 w-4.5" />
    </button>
  </div>

  <span class="bg-border my-1 h-px w-8 shrink-0"></span>

  {#if friendsTab}
    {#each conversations as conversation (conversation.id)}
      {@const active = chat.activeId === conversation.id && !chat.composing}
      {@const unread = shownUnread(conversation)}
      {@const peer = conversation.peer}
      {@const online =
        conversation.peerOnline !== null && peer
          ? (chat.presence[peer.id] ?? conversation.peerOnline)
          : false}
      <div class="group relative flex w-full shrink-0 justify-center py-0.5">
        <span
          class="absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r transition-[height,opacity] duration-200
            {active
            ? 'bg-accent h-9 opacity-100'
            : 'bg-fg h-2 opacity-0 group-hover:h-4 group-hover:opacity-60'}"
          aria-hidden="true"></span>
        <button
          type="button"
          class="relative rounded-xl transition-transform duration-150 hover:scale-105 motion-reduce:transition-none
            {conversation.readOnly ? 'opacity-60' : ''}"
          aria-label={unread
            ? m.chat_conversation_unread({
                name: conversationName(conversation),
                count: unread,
              })
            : conversationName(conversation)}
          aria-current={active ? "true" : undefined}
          onmouseenter={(e) => hover(e, conversation)}
          onfocus={(e) => hover(e, conversation)}
          onmouseleave={() => (hovered = null)}
          onblur={() => (hovered = null)}
          onclick={() => chat.select(conversation.id)}>
          <Avatar
            seed={peer?.username ?? "?"}
            url={peer?.avatarUrl}
            size={44} />
          {#if online}
            <span
              class="bg-success ring-bg absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2"
            ></span>
          {/if}
          {#if unread > 0}
            <span
              class="bg-accent text-accent-fg ring-bg absolute -top-1.5 -right-2 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 font-mono text-[0.62rem] font-bold ring-2">
              {unread > 99 ? "99+" : unread}
            </span>
          {/if}
          {#if conversation.muted}
            <span
              class="bg-surface-2 text-dim ring-bg absolute -bottom-1 -left-1.5 grid h-[18px] w-[18px] place-items-center rounded-full ring-2">
              <Icon name="bell-off" class="h-2.5 w-2.5" />
            </span>
          {/if}
        </button>
      </div>
    {/each}

    <div class="flex-1"></div>
    <button
      type="button"
      class="border-border hover:border-accent hover:bg-surface-2 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed transition-colors duration-150"
      aria-label={m.chat_new_message()}
      title={m.chat_new_message()}
      onclick={() => chat.newMessage()}>
      <Icon name="plus" class="h-4.5 w-4.5" />
    </button>
  {/if}
</nav>

{#if hovered}
  {@const card = hovered.conversation}
  {@const unread = shownUnread(card)}
  <div
    transition:scale={{ duration: reduced ? 0 : 120, start: 0.96 }}
    class="border-border bg-surface pointer-events-none fixed z-[60] flex w-64 flex-col gap-1 rounded-xl border px-3.5 py-3 shadow-xl"
    style="top: {hovered.top}px; left: {hovered.left}px; transform-origin: left top;"
    aria-hidden="true">
    <span class="flex items-baseline justify-between gap-2">
      <b class="truncate font-semibold">{conversationName(card)}</b>
      <span
        class="font-mono text-[0.68rem] {unread ? 'text-accent' : 'text-dim'}"
        >{conversationTime(card)}</span>
    </span>
    <span class="text-dim truncate text-[0.8rem]"
      >{conversationPreview(card)}</span>
    {#if unread > 0}
      <span
        class="text-accent font-mono text-[0.62rem] font-bold tracking-wider uppercase">
        {m.chat_unread_count({ count: unread })}
      </span>
    {:else if card.readOnly}
      <span
        class="text-dim font-mono text-[0.62rem] font-bold tracking-wider uppercase">
        {m.chat_read_only()}
      </span>
    {:else if card.muted}
      <span
        class="text-dim font-mono text-[0.62rem] font-bold tracking-wider uppercase">
        {m.chat_muted()}
      </span>
    {/if}
  </div>
{/if}
