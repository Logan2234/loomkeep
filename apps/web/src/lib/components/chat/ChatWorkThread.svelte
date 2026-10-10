<script lang="ts">
  // A work's discussion in the "Œuvres" tab: its comments, as on its page,
  // under a header naming the work. Read as long as it's on screen.
  import {
    getWorkThread,
    markWorkThreadRead,
    muteWorkThread,
  } from "#lib/api/chat.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { searchComments } from "#lib/api/comments.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat, type WorkThreadRef } from "#lib/chat/chat.svelte.js";
  import CommentThread from "#lib/components/CommentThread.svelte";
  import Dropdown from "#lib/components/Dropdown.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { joinRealtimeRoom, onRealtimeEvent } from "#lib/realtime/socket.js";
  import { revealSpoilersOnOpen } from "#lib/spoiler-default.js";
  import {
    RealtimeEvent,
    type ChatWorkActivityEvent,
    type CommentPresenceEvent,
    type WorkThreadDto,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { untrack } from "svelte";
  import ChatSearchBar from "./ChatSearchBar.svelte";
  import {
    commentHit,
    shortcutsReach,
    workThreadContext,
  } from "./conversation-presentation";

  let {
    work,
    mode,
    onclose,
    onexpand,
    onshrink,
    onback,
  }: {
    work: WorkThreadRef;
    mode: "panel" | "full" | "sheet";
    onclose?: () => void;
    onexpand?: () => void;
    onshrink?: () => void;
    onback?: () => void;
  } = $props();

  const queryClient = useQueryClient();

  const threadQuery = createApiQuery(() => ({
    key: keys.chat.workThread(work.targetType, work.targetId),
    fetch: () => getWorkThread(work.targetType, work.targetId),
  }));
  const thread = $derived(threadQuery.data);

  const muteMut = createApiMutation(() => ({
    mutate: (muted: boolean) =>
      muteWorkThread(work.targetType, work.targetId, muted),
    invalidates: [
      keys.chat.workThread(work.targetType, work.targetId),
      keys.chat.workThreads(),
      keys.chat.unread(),
    ],
    errorToast: true,
  }));
  const context = $derived(thread ? workThreadContext(thread) : null);

  let showSpoilers = $state(
    untrack(() => revealSpoilersOnOpen(work.revealSpoilers ?? false)),
  );
  let peopleHere = $state(1);
  let searching = $state(false);
  let root = $state<HTMLElement | null>(null);
  // A search result, or what the link that opened it points at.
  let focusCommentId = $state(untrack(() => work.focusCommentId ?? null));
  // A reply missing from the page is shown through its comment.
  const parents = new Map<string, string>();

  function focusHit(id: string) {
    searching = false;
    focusCommentId = document.getElementById(`comment-${id}`)
      ? id
      : (parents.get(id) ?? id);
  }

  // Ctrl+F searches the discussion rather than the page, as in a
  // conversation.
  function onwindowkeydown(event: KeyboardEvent) {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.shiftKey || event.altKey) return;
    if (event.key.toLowerCase() !== "f") return;
    if (mode !== "full" && !shortcutsReach(root?.parentElement)) return;
    event.preventDefault();
    if (searching) {
      root?.parentElement
        ?.querySelector<HTMLInputElement>("[data-chat-search]")
        ?.focus();
    } else {
      searching = true;
    }
  }
  const peopleHereLabel = $derived(
    peopleHere === 1
      ? m.comments_person_here()
      : m.comments_people_here({ count: peopleHere }),
  );

  const isThis = (event: { targetType: string; targetId: string }) =>
    event.targetType === work.targetType && event.targetId === work.targetId;

  function markRead() {
    void markWorkThreadRead(work.targetType, work.targetId).then(() => {
      queryClient.setQueryData<WorkThreadDto[]>(
        keys.chat.workThreads(),
        (list) => list?.map((t) => (isThis(t) ? { ...t, unread: 0 } : t)),
      );
      void queryClient.invalidateQueries({ queryKey: keys.chat.unread() });
    });
  }

  $effect(() => {
    const { targetType, targetId } = work;
    const onScreen = `${targetType}:${targetId}`;
    chat.workOnScreen = onScreen;
    untrack(markRead);

    // The room brings the thread's own changes (CommentThread listens to
    // them) and who else is reading it.
    const leave = joinRealtimeRoom("join-comments", "leave-comments", {
      targetType,
      targetId,
    });
    const offs = [
      onRealtimeEvent<CommentPresenceEvent>("comment-presence", (event) => {
        if (isThis(event)) peopleHere = event.count;
      }),
      onRealtimeEvent<{ targetType: string; targetId: string }>(
        "comment-changed",
        (event) => {
          if (!isThis(event)) return;
          void queryClient.invalidateQueries({
            queryKey: keys.chat.workThreads(),
          });
        },
      ),
      onRealtimeEvent<ChatWorkActivityEvent>(
        RealtimeEvent.CHAT_WORK_ACTIVITY,
        (event) => {
          if (isThis(event)) markRead();
        },
      ),
    ];

    return () => {
      for (const off of offs) off();
      leave();
      if (chat.workOnScreen === onScreen) chat.workOnScreen = null;
    };
  });
</script>

<svelte:window onkeydown={onwindowkeydown} />

<!-- On the full-screen page, the notification bell is fixed in the same
     top-right corner: the header leaves it room. -->
<header
  bind:this={root}
  class="border-border flex shrink-0 items-center gap-2.5 border-b py-2.5
    {mode === 'sheet' ? 'pl-1' : 'pl-4'}
    {mode === 'full' ? 'pr-20' : 'pr-2.5'}">
  {#if mode === "sheet"}
    <button
      type="button"
      class="btn-icon h-11 w-11"
      aria-label={m.common_back()}
      onclick={onback}>
      <Icon name="chevron-left" class="h-5 w-5" />
    </button>
  {/if}
  {#if thread}
    <span class="w-8 shrink-0 overflow-hidden rounded">
      <Poster
        src={thread.imageUrl}
        title={thread.title}
        alt=""
        caption={false} />
    </span>
  {:else}
    <span
      class="bg-surface-2 h-12 w-8 shrink-0 animate-pulse rounded"
      aria-hidden="true"></span>
  {/if}
  <div class="min-w-0 flex-1">
    <p
      class="truncate font-semibold
        {mode === 'full' ? 'font-display text-xl font-extrabold' : ''}">
      {#if thread?.href}
        <a
          href={thread.href}
          class="underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-current"
          onclick={() => chat.close()}>{thread.title}</a>
      {:else if thread}
        {thread.title}
      {:else}
        <span
          class="bg-surface-2 my-1 block h-3.5 w-40 max-w-full animate-pulse rounded"
          aria-hidden="true"></span>
      {/if}
    </p>
    <p class="text-dim flex min-w-0 items-center gap-1.5 text-xs">
      {#if context}
        <span class="text-accent font-mono font-bold">{context}</span>
        <span aria-hidden="true">·</span>
      {/if}
      <span class="bg-accent h-1.5 w-1.5 shrink-0 rounded-full"></span>
      <span class="truncate">{peopleHereLabel}</span>
    </p>
  </div>
  <button
    type="button"
    class="btn-icon transition-colors duration-150 {showSpoilers
      ? 'text-accent bg-accent/10'
      : ''}"
    aria-pressed={showSpoilers}
    aria-label={m.comments_show_spoilers()}
    title={m.comments_show_spoilers()}
    onclick={() => (showSpoilers = !showSpoilers)}>
    <Icon name={showSpoilers ? "eye" : "eye-off"} class="h-4.5 w-4.5" />
  </button>
  <Dropdown placement="bottom-end" class="min-w-52">
    {#snippet trigger({ open, toggle, onkeydown })}
      <button
        type="button"
        class="btn-icon"
        aria-label={m.common_more_actions()}
        aria-haspopup="menu"
        aria-expanded={open}
        {onkeydown}
        onclick={toggle}>
        <Icon name="dots-horizontal" class="h-4.5 w-4.5" />
      </button>
    {/snippet}
    {#snippet children({ close })}
      {#if thread?.href}
        <a
          role="menuitem"
          class="menu-item"
          href={thread.href}
          onclick={() => chat.close()}>
          <Icon name="arrow-right" class="h-4 w-4" />
          {m.chat_work_go_to()}
        </a>
      {/if}
      {#if thread}
        <button
          role="menuitem"
          class="menu-item"
          onclick={() => {
            close();
            muteMut.mutate(!thread.muted);
          }}>
          <Icon name={thread.muted ? "bell" : "bell-off"} class="h-4 w-4" />
          {thread.muted ? m.chat_unmute() : m.chat_mute()}
        </button>
      {/if}
      <button
        role="menuitem"
        class="menu-item"
        onclick={() => {
          close();
          searching = true;
        }}>
        <Icon name="search" class="h-4 w-4" />
        {m.chat_search_discussion()}
      </button>
    {/snippet}
  </Dropdown>
  {#if mode === "panel"}
    {#if onexpand}
      <button
        type="button"
        class="btn-icon"
        aria-label={m.chat_fullscreen()}
        title={m.chat_fullscreen()}
        onclick={onexpand}>
        <Icon name="maximize" class="h-4.5 w-4.5" />
      </button>
    {/if}
    {#if onclose}
      <button
        type="button"
        class="btn-icon"
        aria-label={m.common_close()}
        onclick={onclose}>
        <Icon name="x" class="h-4.5 w-4.5" />
      </button>
    {/if}
  {:else if mode === "full" && onshrink}
    <button type="button" class="btn btn-ghost btn-sm" onclick={onshrink}>
      <Icon name="minimize" class="h-4 w-4" />
      {m.common_collapse()}
    </button>
  {/if}
</header>

{#if searching}
  <ChatSearchBar
    key={(query) =>
      keys.chat.commentSearch(work.targetType, work.targetId, query)}
    search={(query) =>
      searchComments(work.targetType, work.targetId, query).then((found) =>
        found.map((comment) => {
          if (comment.parentId) parents.set(comment.id, comment.parentId);
          return commentHit(comment);
        }),
      )}
    label={m.chat_search_discussion()}
    onpick={focusHit}
    onclose={() => (searching = false)} />
{/if}

{#if thread}
  <CommentThread
    targetType={work.targetType}
    targetId={work.targetId}
    canParticipate={thread.canParticipate}
    {focusCommentId}
    {showSpoilers} />
{/if}
