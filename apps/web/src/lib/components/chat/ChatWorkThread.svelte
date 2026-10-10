<script lang="ts">
  // A work's discussion in the "Œuvres" tab: its comments, as on its page,
  // under a header naming the work. Read as long as it's on screen.
  import { getWorkThread, markWorkThreadRead } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat, type WorkThreadRef } from "#lib/chat/chat.svelte.js";
  import CommentThread from "#lib/components/CommentThread.svelte";
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
  import { workThreadContext } from "./conversation-presentation";

  let {
    work,
    mode,
    onclose,
    onback,
  }: {
    work: WorkThreadRef;
    mode: "panel" | "full" | "sheet";
    onclose?: () => void;
    onback?: () => void;
  } = $props();

  const queryClient = useQueryClient();

  const threadQuery = createApiQuery(() => ({
    key: keys.chat.workThread(work.targetType, work.targetId),
    fetch: () => getWorkThread(work.targetType, work.targetId),
  }));
  const thread = $derived(threadQuery.data);
  const context = $derived(thread ? workThreadContext(thread) : null);

  let showSpoilers = $state(
    untrack(() => revealSpoilersOnOpen(work.revealSpoilers ?? false)),
  );
  let peopleHere = $state(1);
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

<!-- On the full-screen page, the notification bell is fixed in the same
     top-right corner: the header leaves it room. -->
<header
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
  {#if onclose}
    <button
      type="button"
      class="btn-icon"
      aria-label={m.common_close()}
      onclick={onclose}>
      <Icon name="x" class="h-4.5 w-4.5" />
    </button>
  {/if}
</header>

{#if thread}
  <CommentThread
    targetType={work.targetType}
    targetId={work.targetId}
    canParticipate={thread.canParticipate}
    focusCommentId={work.focusCommentId ?? null}
    {showSpoilers} />
{/if}
