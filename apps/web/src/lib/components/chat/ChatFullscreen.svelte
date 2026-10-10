<script lang="ts">
  // /app/messages[/<id>]: Messages as a page — the conversation list beside
  // the open conversation. "Réduire" puts it back in the floating panel.
  import { goto } from "$app/navigation";
  import {
    getChatUnread,
    getConversations,
    getWorkThreads,
  } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import ChatSearchField from "./ChatSearchField.svelte";
  import ChatConversationRow from "./ChatConversationRow.svelte";
  import ChatNewMessage from "./ChatNewMessage.svelte";
  import ChatThread from "./ChatThread.svelte";
  import ChatWorkList from "./ChatWorkList.svelte";
  import ChatWorkThread from "./ChatWorkThread.svelte";
  import {
    conversationStep,
    escapeReaches,
    neighbourConversation,
    neighbourWork,
    shownUnread,
  } from "./conversation-presentation";

  let { conversationId }: { conversationId: string | null } = $props();

  let composing = $state(false);
  let root = $state<HTMLElement | null>(null);
  let search = $state("");

  const conversationsQuery = createApiQuery(() => ({
    key: keys.chat.conversations(),
    fetch: () => getConversations(),
  }));
  const conversations = $derived(conversationsQuery.data?.items ?? []);
  const unread = $derived(
    conversations.reduce((sum, c) => sum + shownUnread(c), 0),
  );
  const unreadQuery = createApiQuery(() => ({
    key: keys.chat.unread(),
    fetch: getChatUnread,
  }));
  const worksUnread = $derived(unreadQuery.data?.works ?? 0);
  const worksTab = $derived(chat.tab === "works");
  const threadsQuery = createApiQuery(() => ({
    key: keys.chat.workThreads(),
    fetch: getWorkThreads,
  }));
  const threads = $derived(threadsQuery.data ?? []);
  const shown = $derived(
    conversations.filter((c) =>
      (c.peer?.displayName ?? "")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ),
  );

  function open(id: string) {
    composing = false;
    void goto(`/app/messages/${id}`);
  }

  function onkeydown(event: KeyboardEvent) {
    // Escape leaves the page as "Réduire" does, once nothing else wants it.
    if (event.key === "Escape") {
      if (!event.defaultPrevented && !layout.compact && escapeReaches(root)) {
        shrink();
      }
      return;
    }

    const step = conversationStep(event);
    if (!step) return;
    if (worksTab) {
      const next = neighbourWork(threads, chat.activeWork, step);
      if (next) {
        event.preventDefault();
        chat.activeWork = next;
      }
      return;
    }
    const next = neighbourConversation(conversations, conversationId, step);
    if (next) {
      event.preventDefault();
      open(next);
    }
  }

  // Back to where Messages was opened from, however many conversations
  // were browsed since — not one step back.
  function shrink() {
    if (worksTab && chat.activeWork) chat.showWork(chat.activeWork);
    else if (conversationId) chat.show(conversationId);
    void goto(chat.returnTo ?? "/app");
  }

  // The compact shell shows one column: the list, or the conversation.
  const showList = $derived(
    !layout.compact ||
      (worksTab ? !chat.activeWork : !conversationId && !composing),
  );
  const showThread = $derived(!layout.compact || !showList);
</script>

<svelte:window {onkeydown} />

<!-- One screen tall: the list and the conversation scroll on their own. On
     the compact shell, the bottom bar keeps its share of the height. -->
<div
  bind:this={root}
  class="flex min-h-0 {layout.compact
    ? 'h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))]'
    : 'h-dvh'}">
  {#if showList}
    <aside
      aria-label={m.chat_conversations()}
      class="border-border bg-surface flex min-h-0 shrink-0 flex-col gap-2 px-2.5 pt-5 pb-2.5
        {layout.compact ? 'w-full' : 'w-[340px] border-r'}">
      <div class="flex items-center px-2">
        <h1 class="font-display min-w-0 flex-1 text-2xl font-extrabold">
          {m.chat_title()}
        </h1>
        {#if chat.tab === "friends"}
          <button
            type="button"
            class="btn-icon"
            aria-label={m.chat_new_message()}
            onclick={() => (composing = true)}>
            <Icon name="plus" class="h-5 w-5" />
          </button>
        {/if}
      </div>
      <div role="tablist" class="bg-bg grid grid-cols-2 gap-1 rounded-xl p-1">
        <button
          type="button"
          role="tab"
          aria-selected={chat.tab === "friends"}
          class="flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors duration-150
            {chat.tab === 'friends' ? 'bg-surface-2 text-fg' : 'text-dim'}"
          onclick={() => {
            chat.tab = "friends";
            // On a phone the list and a conversation share the screen.
            if (layout.compact && conversationId) void goto("/app/messages");
          }}>
          {m.common_friends()}
          {#if unread > 0}
            <span
              class="bg-accent text-accent-fg grid h-5 min-w-5 place-items-center rounded-full px-1.5 font-mono text-[0.68rem] font-bold">
              {unread > 99 ? "99+" : unread}
            </span>
          {/if}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={chat.tab === "works"}
          class="flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors duration-150
            {chat.tab === 'works' ? 'bg-surface-2 text-fg' : 'text-dim'}"
          onclick={() => (chat.tab = "works")}>
          {m.common_works()}
          {#if worksUnread > 0}
            <span
              class="bg-accent text-accent-fg grid h-5 min-w-5 place-items-center rounded-full px-1.5 font-mono text-[0.68rem] font-bold">
              {worksUnread > 99 ? "99+" : worksUnread}
            </span>
          {/if}
        </button>
      </div>
      {#if chat.tab === "friends"}
        <ChatSearchField bind:value={search} height="h-10" />
        <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {#each shown as conversation (conversation.id)}
            <ChatConversationRow
              {conversation}
              active={conversation.id === conversationId && !composing}
              onselect={open} />
          {:else}
            {#if !conversationsQuery.loading}
              <p class="text-dim px-3 py-6 text-center text-sm">
                {search ? m.common_no_results() : m.chat_no_conversation()}
              </p>
            {/if}
          {/each}
        </div>
      {:else}
        <ChatWorkList
          active={chat.activeWork}
          onselect={(work) => (chat.activeWork = work)} />
      {/if}
    </aside>
  {/if}

  {#if showThread}
    <main class="flex min-h-0 min-w-0 flex-1 flex-col">
      {#if worksTab && chat.activeWork}
        {#key `${chat.activeWork.targetType}:${chat.activeWork.targetId}`}
          <ChatWorkThread
            work={chat.activeWork}
            mode={layout.compact ? "sheet" : "full"}
            onshrink={shrink}
            onback={() => (chat.activeWork = null)} />
        {/key}
      {:else if worksTab}
        <div
          class="text-dim flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Icon name="tv" class="h-9 w-9" />
          <p class="max-w-[34ch] text-sm">{m.chat_works_pick()}</p>
        </div>
      {:else if composing}
        <ChatNewMessage
          mode={layout.compact ? "sheet" : "full"}
          onopen={open}
          onback={() => (composing = false)} />
      {:else if conversationId}
        {#key conversationId}
          <ChatThread
            {conversationId}
            mode={layout.compact ? "sheet" : "full"}
            onshrink={shrink}
            onback={() => void goto("/app/messages")} />
        {/key}
      {:else}
        <div
          class="text-dim flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Icon name="message" class="h-9 w-9" />
          <p class="max-w-[34ch] text-sm">{m.chat_pick_conversation()}</p>
        </div>
      {/if}
    </main>
  {/if}
</div>
