<script lang="ts">
  import { longpress } from "#lib/actions/longpress.js";
  import {
    hideConversation,
    markConversationRead,
    muteConversation,
    pinConversation,
  } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Drawer from "#lib/components/Drawer.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { ConversationDto } from "@loomkeep/shared";
  import { fade } from "svelte/transition";
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

  const reduced = prefersReducedMotion();
  const peer = $derived(conversation.peer);
  const online = $derived(
    conversation.peerOnline !== null && peer
      ? (chat.presence[peer.id] ?? conversation.peerOnline)
      : false,
  );
  const unread = $derived(conversation.unread);
  // The phone's long-press sheet: what the open conversation's menu offers,
  // without opening it.
  let sheetOpen = $state(false);
  let confirmingDelete = $state(false);

  const readMut = createApiMutation(() => ({
    mutate: () => markConversationRead(conversation.id),
    invalidates: [keys.chat.conversations(), keys.chat.unread()],
    errorToast: true,
  }));

  const muteMut = createApiMutation(() => ({
    mutate: (muted: boolean) => muteConversation(conversation.id, muted),
    invalidates: [
      keys.chat.conversations(),
      keys.chat.conversation(conversation.id),
      keys.chat.unread(),
    ],
    errorToast: true,
  }));

  const pinMut = createApiMutation(() => ({
    mutate: (pinned: boolean) => pinConversation(conversation.id, pinned),
    invalidates: [keys.chat.conversations()],
    errorToast: true,
  }));

  const hideMut = createApiMutation(() => ({
    mutate: () => hideConversation(conversation.id),
    invalidates: [keys.chat.conversations(), keys.chat.unread()],
    onSuccess: () => close(),
    errorToast: true,
  }));

  function openSheet() {
    confirmingDelete = false;
    sheetOpen = true;
  }

  function close() {
    sheetOpen = false;
    confirmingDelete = false;
  }
</script>

<button
  type="button"
  class="hover:bg-surface-2 relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150
    {active ? 'bg-surface-2' : ''}"
  aria-current={active ? "true" : undefined}
  use:longpress={{ onLongPress: openSheet, enabled: layout.compact }}
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
    {#if conversation.muted}
      <!-- Where the rail shows it: the online dot keeps the other corner. -->
      <span
        role="img"
        aria-label={m.chat_muted()}
        title={m.chat_muted()}
        class="bg-surface-2 text-dim ring-surface absolute -bottom-1 -left-1.5 grid h-[18px] w-[18px] place-items-center rounded-full ring-2">
        <Icon name="bell-off" class="h-2.5 w-2.5" />
      </span>
    {/if}
  </span>
  <span class="min-w-0 flex-1">
    <span class="flex items-baseline justify-between gap-2">
      <span class="truncate font-semibold"
        >{conversationName(conversation)}</span>
      <span
        class="text-micro flex shrink-0 items-center gap-1 font-mono {unread
          ? 'text-accent'
          : 'text-dim'}">
        {#if conversation.pinned}
          <span role="img" aria-label={m.chat_pinned()} class="text-dim">
            <Icon name="pin-filled" class="h-3 w-3" />
          </span>
        {/if}
        {conversationTime(conversation)}
      </span>
    </span>
    <span
      class="flex items-center gap-1 truncate text-[0.8rem] {unread
        ? 'text-fg'
        : 'text-dim'}">
      {#if conversation.readOnly}
        <Icon name="lock" class="h-3 w-3 shrink-0" />
      {/if}
      <span class="truncate">{conversationPreview(conversation)}</span>
    </span>
  </span>
  {#if unread > 0}
    <span
      class="text-micro grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 font-mono font-bold {badgeTone(
        conversation.muted,
      )}">
      {unread > 99 ? "99+" : unread}
    </span>
  {/if}
</button>

{#if sheetOpen}
  <Drawer onclose={close} zIndex={60} label={conversationName(conversation)}>
    <div class="flex flex-col gap-2 px-3 pt-1 pb-3">
      <div class="flex items-center gap-3 px-5 pb-1">
        <Avatar seed={peer?.username ?? "?"} url={peer?.avatarUrl} size={40} />
        <span class="min-w-0">
          <span class="block truncate font-semibold"
            >{conversationName(conversation)}</span>
          <span class="text-dim block truncate text-[0.8rem]"
            >{conversationPreview(conversation)}</span>
        </span>
      </div>
      <div class="flex flex-col" data-menu-sheet role="menu">
        {#if confirmingDelete}
          <div
            in:fade={{ duration: reduced ? 0 : 150 }}
            class="flex flex-col gap-2 px-2.5 py-2 text-sm">
            <p class="font-semibold">{m.chat_conversation_delete_confirm()}</p>
            <p class="text-dim text-xs">{m.chat_conversation_delete_hint()}</p>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onclick={() => (confirmingDelete = false)}>
                {m.common_cancel()}
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                disabled={hideMut.loading}
                onclick={() => hideMut.mutate()}>
                {m.common_delete()}
              </button>
            </div>
          </div>
        {:else}
          {#if unread > 0}
            <button
              role="menuitem"
              class="menu-item"
              onclick={() => {
                close();
                readMut.mutate();
              }}>
              <Icon name="check-check" class="h-4 w-4" />
              {m.chat_mark_read()}
            </button>
          {/if}
          <button
            role="menuitem"
            class="menu-item"
            onclick={() => {
              close();
              muteMut.mutate(!conversation.muted);
            }}>
            <Icon
              name={conversation.muted ? "bell" : "bell-off"}
              class="h-4 w-4" />
            {conversation.muted ? m.chat_unmute() : m.chat_mute()}
          </button>
          <button
            role="menuitem"
            class="menu-item"
            onclick={() => {
              close();
              pinMut.mutate(!conversation.pinned);
            }}>
            <Icon
              name={conversation.pinned ? "pin-filled" : "pin"}
              class="h-4 w-4" />
            {conversation.pinned ? m.chat_unpin() : m.chat_pin()}
          </button>
          {#if peer}
            <a
              role="menuitem"
              class="menu-item"
              href="/app/u/{peer.username}"
              onclick={() => {
                close();
                chat.close();
              }}>
              <Icon name="user" class="h-4 w-4" />
              {m.chat_view_profile()}
            </a>
          {/if}
          <button
            role="menuitem"
            class="menu-item menu-item-danger border-border border-t"
            onclick={() => (confirmingDelete = true)}>
            <Icon name="trash" class="h-4 w-4" />
            {m.chat_conversation_delete_ellipsis()}
          </button>
        {/if}
      </div>
    </div>
  </Drawer>
{/if}
