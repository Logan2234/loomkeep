<script lang="ts">
  import { chat } from "#lib/chat/chat.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import type { ConversationDto } from "@loomkeep/shared";
  import {
    conversationName,
    conversationPreview,
    conversationTime,
    badgeTone,
  } from "./conversation-presentation";

  let {
    conversation,
    active = false,
    size = 44,
    onselect,
  }: {
    conversation: ConversationDto;
    active?: boolean;
    size?: number;
    onselect: (id: string) => void;
  } = $props();

  const peer = $derived(conversation.peer);
  const online = $derived(
    conversation.peerOnline !== null && peer
      ? (chat.presence[peer.id] ?? conversation.peerOnline)
      : false,
  );
  const unread = $derived(conversation.unread);
</script>

<button
  type="button"
  class="hover:bg-surface-2 relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150
    {active ? 'bg-surface-2' : ''}"
  aria-current={active ? "true" : undefined}
  onclick={() => onselect(conversation.id)}>
  {#if active}
    <span
      class="bg-accent absolute top-1/2 left-0 h-8 w-1 -translate-y-1/2 rounded-r"
      aria-hidden="true"></span>
  {/if}
  <span class="relative shrink-0">
    <Avatar seed={peer?.username ?? "?"} url={peer?.avatarUrl} {size} />
    {#if online}
      <span
        class="bg-success ring-surface absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2"
      ></span>
    {/if}
  </span>
  <span class="min-w-0 flex-1">
    <span class="flex items-baseline justify-between gap-2">
      <span class="truncate font-semibold"
        >{conversationName(conversation)}</span>
      <span
        class="shrink-0 font-mono text-[0.68rem] {unread
          ? 'text-accent'
          : 'text-dim'}">{conversationTime(conversation)}</span>
    </span>
    <span
      class="flex items-center gap-1 truncate text-[0.8rem] {unread
        ? 'text-fg'
        : 'text-dim'}">
      {#if conversation.readOnly}
        <Icon name="lock" class="h-3 w-3 shrink-0" />
      {:else if conversation.muted}
        <Icon name="bell-off" class="h-3 w-3 shrink-0" />
      {/if}
      <span class="truncate">{conversationPreview(conversation)}</span>
    </span>
  </span>
  {#if unread > 0}
    <span
      class="grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 font-mono text-[0.68rem] font-bold {badgeTone(
        conversation.muted,
      )}">
      {unread > 99 ? "99+" : unread}
    </span>
  {/if}
</button>
