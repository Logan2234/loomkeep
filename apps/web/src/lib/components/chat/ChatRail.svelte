<script lang="ts">
  import { chat, type ChatTab } from "#lib/chat/chat.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import type { ConversationDto } from "@loomkeep/shared";
  import { fade, scale } from "svelte/transition";
  import {
    conversationName,
    conversationPreview,
    conversationTime,
    shownUnread,
  } from "./conversation-presentation";

  let { conversations }: { conversations: ConversationDto[] } = $props();

  const TABS: { id: ChatTab; icon: IconName; label: string }[] = [
    { id: "friends", icon: "users", label: m.common_friends() },
    { id: "works", icon: "tv", label: m.common_works() },
  ];

  const reduced = prefersReducedMotion();
  let search = $state("");
  let hovered = $state<{
    conversation: ConversationDto;
    top: number;
    left: number;
  } | null>(null);

  // Unfolded, the rail itself widens: the same avatars, with their names and
  // last message beside them. Folded, a hover card stands in for those.
  const unfolded = $derived(chat.drawer);
  const friendsTab = $derived(chat.tab === "friends");
  const shown = $derived(
    unfolded && search.trim()
      ? conversations.filter((c) =>
          (c.peer?.displayName ?? "")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
      : conversations,
  );

  function hover(event: Event, conversation: ConversationDto) {
    if (unfolded) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    hovered = { conversation, top: box.top - 4, left: box.right + 12 };
  }

  function toggle() {
    hovered = null;
    chat.drawer = !chat.drawer;
  }
</script>

<nav
  aria-label={m.chat_conversations()}
  class="bg-bg border-border flex shrink-0 flex-col gap-1.5 overflow-x-hidden overflow-y-auto rounded-l-2xl border-r py-2.5 transition-[width] duration-200 ease-out motion-reduce:transition-none
    {unfolded ? 'w-[284px]' : 'w-[76px]'}">
  <div
    class="flex shrink-0 gap-1.5 px-4
      {unfolded ? 'flex-row items-center' : 'flex-col items-center'}">
    <button
      type="button"
      class="btn-icon shrink-0"
      aria-label={unfolded ? m.chat_fold_list() : m.chat_unfold_list()}
      title={unfolded ? m.chat_fold_list() : m.chat_unfold_list()}
      aria-expanded={unfolded}
      onclick={toggle}>
      <Icon
        name="chevron-left"
        class="h-4.5 w-4.5 transition-transform duration-200 motion-reduce:transition-none
          {unfolded ? 'rotate-180' : ''}" />
    </button>

    <div
      role="tablist"
      aria-orientation={unfolded ? "horizontal" : "vertical"}
      class="bg-surface flex gap-1 rounded-xl p-1
        {unfolded ? 'min-w-0 flex-1 flex-row' : 'flex-col'}">
      {#each TABS as tab (tab.id)}
        {@const selected = chat.tab === tab.id}
        <button
          type="button"
          role="tab"
          aria-selected={selected}
          aria-label={tab.label}
          title={unfolded ? undefined : tab.label}
          class="flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors duration-150
            {unfolded ? 'min-w-0 flex-1 px-2' : 'w-9'}
            {selected ? 'bg-surface-2 text-fg' : 'text-dim hover:text-fg'}"
          onclick={() => (chat.tab = tab.id)}>
          <Icon name={tab.icon} class="h-4.5 w-4.5 shrink-0" />
          {#if unfolded}
            <span
              in:fade={{ duration: reduced ? 0 : 150, delay: reduced ? 0 : 80 }}
              class="truncate">{tab.label}</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  {#if unfolded && friendsTab}
    <div
      transition:fade={{ duration: reduced ? 0 : 150 }}
      class="shrink-0 px-3 pt-1">
      <label class="input flex h-9 items-center gap-2 py-0">
        <Icon name="search" class="text-dim h-4 w-4 shrink-0" />
        <span class="sr-only">{m.chat_search_friends()}</span>
        <input
          bind:value={search}
          class="min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder={m.chat_search_friends()} />
      </label>
    </div>
  {/if}

  <span class="bg-border mx-[22px] my-1 h-px shrink-0"></span>

  {#if friendsTab}
    {#each shown as conversation (conversation.id)}
      {@const active = chat.activeId === conversation.id && !chat.composing}
      {@const unread = shownUnread(conversation)}
      {@const peer = conversation.peer}
      {@const online =
        conversation.peerOnline !== null && peer
          ? (chat.presence[peer.id] ?? conversation.peerOnline)
          : false}
      <div class="group relative w-full shrink-0 px-1.5">
        <span
          class="absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r transition-[height,opacity] duration-200
            {active
            ? 'bg-accent h-9 opacity-100'
            : 'bg-fg h-2 opacity-0 group-hover:h-4 group-hover:opacity-60'}"
          aria-hidden="true"></span>
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl py-1 pr-2 pl-2.5 text-left transition-colors duration-150
            {unfolded && active ? 'bg-surface-2' : ''}
            {unfolded ? 'hover:bg-surface-2' : ''}"
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
          <span
            class="relative shrink-0 rounded-xl transition-transform duration-150 motion-reduce:transition-none
              {unfolded ? '' : 'group-hover:scale-105'}
              {conversation.readOnly ? 'opacity-60' : ''}">
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
          </span>
          {#if unfolded}
            <span
              in:fade={{ duration: reduced ? 0 : 150, delay: reduced ? 0 : 80 }}
              class="min-w-0 flex-1"
              aria-hidden="true">
              <span class="flex items-baseline justify-between gap-2">
                <span class="truncate font-semibold"
                  >{conversationName(conversation)}</span>
                <span
                  class="shrink-0 font-mono text-[0.68rem] {unread
                    ? 'text-accent'
                    : 'text-dim'}">{conversationTime(conversation)}</span>
              </span>
              <span
                class="flex items-center gap-1 text-[0.8rem] {unread
                  ? 'text-fg'
                  : 'text-dim'}">
                {#if conversation.readOnly}
                  <Icon name="lock" class="h-3 w-3 shrink-0" />
                {/if}
                <span class="truncate"
                  >{conversationPreview(conversation)}</span>
              </span>
            </span>
          {/if}
        </button>
      </div>
    {:else}
      {#if unfolded && search.trim()}
        <p class="text-dim px-3 py-4 text-center text-sm">
          {m.common_no_results()}
        </p>
      {/if}
    {/each}

    <div class="flex-1"></div>
    <div class="shrink-0 px-1.5">
      <button
        type="button"
        class="group text-accent hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl py-1 pr-2 pl-3 text-sm font-semibold transition-colors duration-150"
        aria-label={m.chat_new_message()}
        title={unfolded ? undefined : m.chat_new_message()}
        onclick={() => chat.newMessage()}>
        <span
          class="border-border text-fg group-hover:border-accent grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed transition-colors duration-150">
          <Icon name="plus" class="h-4.5 w-4.5" />
        </span>
        {#if unfolded}
          <span
            in:fade={{ duration: reduced ? 0 : 150, delay: reduced ? 0 : 80 }}
            class="truncate"
            aria-hidden="true">{m.chat_new_message()}</span>
        {/if}
      </button>
    </div>
  {/if}
</nav>

{#if hovered && !unfolded}
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
