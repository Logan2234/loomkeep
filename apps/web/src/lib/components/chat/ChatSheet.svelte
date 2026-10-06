<script lang="ts">
  // Messages on the compact shell: a full-screen veil, list then
  // conversation, opened from the bottom bar's Messages tab.
  import { getConversations } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { fly } from "svelte/transition";
  import ChatConversationRow from "./ChatConversationRow.svelte";
  import ChatNewMessage from "./ChatNewMessage.svelte";
  import ChatThread from "./ChatThread.svelte";
  import ChatWorksSoon from "./ChatWorksSoon.svelte";
  import { shownUnread } from "./conversation-presentation";

  const reduced = prefersReducedMotion();

  const conversationsQuery = createApiQuery(() => ({
    key: keys.chat.conversations(),
    fetch: () => getConversations(),
  }));
  const conversations = $derived(conversationsQuery.data?.items ?? []);
  const unread = $derived(
    conversations.reduce((sum, c) => sum + shownUnread(c), 0),
  );

  let search = $state("");
  const shown = $derived(
    conversations.filter((c) =>
      (c.peer?.displayName ?? "")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ),
  );
</script>

<div
  role="dialog"
  aria-modal="true"
  aria-label={m.chat_title()}
  transition:fly={{ y: 24, duration: reduced ? 0 : 240 }}
  class="bg-surface fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
  {#if chat.composing}
    <div
      class="flex min-h-0 flex-1 flex-col"
      in:fly={{ x: 18, duration: reduced ? 0 : 200 }}>
      <ChatNewMessage
        mode="sheet"
        onopen={(id) => chat.select(id)}
        onback={() => chat.back()} />
    </div>
  {:else if chat.activeId}
    {#key chat.activeId}
      <div
        class="flex min-h-0 flex-1 flex-col"
        in:fly={{ x: 18, duration: reduced ? 0 : 200 }}>
        <ChatThread
          conversationId={chat.activeId}
          mode="sheet"
          onback={() => chat.back()} />
      </div>
    {/key}
  {:else}
    <header class="flex items-center gap-1 px-2 pt-3 pb-1">
      <button
        type="button"
        class="btn-icon h-11 w-11"
        aria-label={m.chat_close()}
        onclick={() => chat.close()}>
        <Icon name="x" class="h-5 w-5" />
      </button>
      <h2 class="font-display min-w-0 flex-1 text-2xl font-extrabold">
        {m.chat_title()}
      </h2>
      {#if chat.tab === "friends"}
        <button
          type="button"
          class="btn-icon h-11 w-11"
          aria-label={m.chat_new_message()}
          onclick={() => chat.newMessage()}>
          <Icon name="plus" class="h-5 w-5" />
        </button>
      {/if}
    </header>

    <div class="px-4 pt-1 pb-2.5">
      <div role="tablist" class="bg-bg grid grid-cols-2 gap-1 rounded-xl p-1">
        <button
          type="button"
          role="tab"
          aria-selected={chat.tab === "friends"}
          class="flex h-10 items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150
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
          class="flex h-10 items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150
            {chat.tab === 'works' ? 'bg-surface-2 text-fg' : 'text-dim'}"
          onclick={() => (chat.tab = "works")}>
          {m.common_works()}
        </button>
      </div>
    </div>

    {#if chat.tab === "friends"}
      <div class="px-4 pb-1.5">
        <label class="input flex h-11 items-center gap-2 py-0">
          <Icon name="search" class="text-dim h-4.5 w-4.5 shrink-0" />
          <span class="sr-only">{m.chat_search_friends()}</span>
          <input
            bind:value={search}
            class="min-w-0 flex-1 bg-transparent outline-none"
            placeholder={m.chat_search_friends()} />
        </label>
      </div>
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-2">
        {#each shown as conversation (conversation.id)}
          <ChatConversationRow
            {conversation}
            size={48}
            onselect={(id) => chat.select(id)} />
        {:else}
          {#if !conversationsQuery.loading}
            <div
              class="text-dim flex flex-col items-center gap-3 px-6 py-10 text-center text-sm">
              <p>{search ? m.common_no_results() : m.chat_no_conversation()}</p>
              {#if !search}
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  onclick={() => chat.newMessage()}>
                  {m.chat_new_message()}
                </button>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <ChatWorksSoon />
    {/if}
  {/if}
</div>
