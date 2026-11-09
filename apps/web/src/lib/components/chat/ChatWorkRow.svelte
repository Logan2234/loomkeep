<script lang="ts">
  import { longpress } from "#lib/actions/longpress.js";
  import {
    markWorkThreadRead,
    muteWorkThread,
    pinWorkThread,
    unfollowWorkThread,
  } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Drawer from "#lib/components/Drawer.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import type { WorkThreadDto } from "@loomkeep/shared";
  import {
    badgeTone,
    workThreadContext,
    workThreadPreview,
    workThreadTime,
  } from "./conversation-presentation";

  let {
    thread,
    active = false,
    onselect,
  }: {
    thread: WorkThreadDto;
    active?: boolean;
    onselect: (thread: WorkThreadDto) => void;
  } = $props();

  const context = $derived(workThreadContext(thread));
  // The phone's long-press sheet: what the open discussion's menu offers,
  // without opening it.
  let sheetOpen = $state(false);

  const threadKeys = () => [
    keys.chat.workThreads(),
    keys.chat.workThread(thread.targetType, thread.targetId),
    keys.chat.unread(),
  ];

  const readMut = createApiMutation(() => ({
    mutate: () => markWorkThreadRead(thread.targetType, thread.targetId),
    invalidates: threadKeys(),
    errorToast: true,
  }));

  const muteMut = createApiMutation(() => ({
    mutate: (muted: boolean) =>
      muteWorkThread(thread.targetType, thread.targetId, muted),
    invalidates: threadKeys(),
    errorToast: true,
  }));

  const pinMut = createApiMutation(() => ({
    mutate: (pinned: boolean) =>
      pinWorkThread(thread.targetType, thread.targetId, pinned),
    invalidates: [keys.chat.workThreads()],
    errorToast: true,
  }));

  const unfollowMut = createApiMutation(() => ({
    mutate: () => unfollowWorkThread(thread.targetType, thread.targetId),
    invalidates: threadKeys(),
    onSuccess: () => toast.success(m.chat_work_unfollowed()),
    errorToast: true,
  }));

  function run(action: () => void) {
    sheetOpen = false;
    action();
  }
</script>

<button
  type="button"
  class="hover:bg-surface-2 relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150
    {active ? 'bg-surface-2' : ''}"
  aria-current={active ? "true" : undefined}
  use:longpress={{
    onLongPress: () => (sheetOpen = true),
    enabled: layout.compact,
  }}
  onclick={() => onselect(thread)}>
  {#if active}
    <span
      class="bg-accent absolute top-1/2 left-0 h-8 w-1 -translate-y-1/2 rounded-r"
      aria-hidden="true"></span>
  {/if}
  <span class="w-9 shrink-0 overflow-hidden rounded-md">
    <Poster src={thread.imageUrl} title={thread.title} alt="" caption={false} />
  </span>
  <span class="min-w-0 flex-1">
    <span class="flex items-baseline justify-between gap-2">
      <span class="truncate font-semibold">{thread.title}</span>
      <span
        class="text-micro flex shrink-0 items-center gap-1 font-mono {thread.unread
          ? 'text-accent'
          : 'text-dim'}">
        {#if thread.pinned}
          <span role="img" aria-label={m.chat_pinned()} class="text-dim">
            <Icon name="pin-filled" class="h-3 w-3" />
          </span>
        {/if}
        {workThreadTime(thread)}
      </span>
    </span>
    {#if context}
      <span
        class="text-accent text-micro block font-mono font-bold tracking-wider uppercase">
        {context}
      </span>
    {/if}
    <span
      class="flex items-center gap-1 text-[0.8rem] {thread.unread
        ? 'text-fg'
        : 'text-dim'}">
      {#if thread.muted}
        <Icon name="bell-off" class="h-3 w-3 shrink-0" />
      {/if}
      <span class="truncate">{workThreadPreview(thread)}</span>
    </span>
  </span>
  {#if thread.unread > 0}
    <span
      class="text-micro grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 font-mono font-bold {badgeTone(
        thread.muted,
      )}">
      {thread.unread > 99 ? "99+" : thread.unread}
    </span>
  {/if}
</button>

{#if sheetOpen}
  <Drawer onclose={() => (sheetOpen = false)} zIndex={60} label={thread.title}>
    <div class="flex flex-col gap-2 px-3 pt-1 pb-3">
      <div class="flex items-center gap-3 px-5 pb-1">
        <span class="w-10 shrink-0 overflow-hidden rounded">
          <Poster
            src={thread.imageUrl}
            title={thread.title}
            alt=""
            caption={false} />
        </span>
        <span class="min-w-0">
          <span class="block truncate font-semibold">{thread.title}</span>
          {#if context}
            <span
              class="text-accent text-micro block font-mono font-bold tracking-wider uppercase"
              >{context}</span>
          {/if}
          <span class="text-dim block truncate text-[0.8rem]"
            >{workThreadPreview(thread)}</span>
        </span>
      </div>
      <div class="flex flex-col" data-menu-sheet role="menu">
        {#if thread.unread > 0}
          <button
            role="menuitem"
            class="menu-item"
            onclick={() => run(() => readMut.mutate())}>
            <Icon name="check-check" class="h-4 w-4" />
            {m.chat_mark_read()}
          </button>
        {/if}
        <button
          role="menuitem"
          class="menu-item"
          onclick={() => run(() => muteMut.mutate(!thread.muted))}>
          <Icon name={thread.muted ? "bell" : "bell-off"} class="h-4 w-4" />
          {thread.muted ? m.chat_unmute() : m.chat_mute()}
        </button>
        <button
          role="menuitem"
          class="menu-item"
          onclick={() => run(() => pinMut.mutate(!thread.pinned))}>
          <Icon name={thread.pinned ? "pin-filled" : "pin"} class="h-4 w-4" />
          {thread.pinned ? m.chat_unpin() : m.chat_pin()}
        </button>
        {#if thread.href}
          <a
            role="menuitem"
            class="menu-item"
            href={thread.href}
            onclick={() => {
              sheetOpen = false;
              chat.close();
            }}>
            <Icon name="arrow-right" class="h-4 w-4" />
            {m.chat_work_go_to()}
          </a>
        {/if}
        <button
          role="menuitem"
          class="menu-item border-border border-t"
          onclick={() => run(() => unfollowMut.mutate())}>
          <Icon name="eye-off" class="h-4 w-4" />
          {m.chat_work_unfollow()}
        </button>
      </div>
    </div>
  </Drawer>
{/if}
