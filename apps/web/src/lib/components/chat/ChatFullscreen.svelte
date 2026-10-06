<script lang="ts">
  // /app/messages[/<id>]: Messages as a page — the conversation list beside
  // the open conversation. "Réduire" puts it back in the floating panel.
  import { goto } from "$app/navigation";
  import { getConversations } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { hasAppHistory } from "#lib/backNav.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import ChatConversationRow from "./ChatConversationRow.svelte";
  import ChatNewMessage from "./ChatNewMessage.svelte";
  import ChatThread from "./ChatThread.svelte";
  import ChatWorksSoon from "./ChatWorksSoon.svelte";
  import { shownUnread } from "./conversation-presentation";

  let { conversationId }: { conversationId: string | null } = $props();

  let composing = $state(false);
  let search = $state("");

  const conversationsQuery = createApiQuery(() => ({
    key: keys.chat.conversations(),
    fetch: () => getConversations(),
  }));
  const conversations = $derived(conversationsQuery.data?.items ?? []);
  const unread = $derived(
    conversations.reduce((sum, c) => sum + shownUnread(c), 0),
  );
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

  function shrink() {
    if (conversationId) chat.show(conversationId);
    if (hasAppHistory()) history.back();
    else void goto("/app");
  }

  // The compact shell shows one column: the list, or the conversation.
  const showList = $derived(!layout.compact || (!conversationId && !composing));
  const showThread = $derived(!layout.compact || !!conversationId || composing);
</script>

<!-- One screen tall: the list and the conversation scroll on their own. On
     the compact shell, the bottom bar keeps its share of the height. -->
<div
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
          onclick={() => (chat.tab = "friends")}>
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
        </button>
      </div>
      {#if chat.tab === "friends"}
        <label class="input flex h-10 items-center gap-2 py-0">
          <Icon name="search" class="text-dim h-4 w-4 shrink-0" />
          <span class="sr-only">{m.chat_search_friends()}</span>
          <input
            bind:value={search}
            class="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder={m.chat_search_friends()} />
        </label>
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
        <ChatWorksSoon />
      {/if}
    </aside>
  {/if}

  {#if showThread}
    <main class="flex min-h-0 min-w-0 flex-1 flex-col">
      {#if composing}
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
