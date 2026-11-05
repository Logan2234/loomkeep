<script lang="ts">
  import EmptyArt from "#lib/components/EmptyArt.svelte";
  import { tabSwipe } from "#lib/tab-swipe.js";
  // Messages on the compact shell: a full-screen veil, list then
  // conversation, opened from the bottom bar's Messages tab.
  import { getChatUnread, getConversations } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import ChatSearchField from "./ChatSearchField.svelte";
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import ChatConversationRow from "./ChatConversationRow.svelte";
  import ChatNewMessage from "./ChatNewMessage.svelte";
  import ChatThread from "./ChatThread.svelte";
  import ChatWorkList from "./ChatWorkList.svelte";
  import ChatWorkThread from "./ChatWorkThread.svelte";
  import { shownUnread } from "./conversation-presentation";

  const reduced = prefersReducedMotion();
  const slide = {
    x: "100%",
    opacity: 1,
    duration: reduced ? 0 : 260,
    easing: cubicOut,
  };
  // Over the list, which stays put beneath: a conversation slides in from the
  // right and back out the same way. The veil's padding isn't inherited here.
  const PANE =
    "bg-surface absolute inset-0 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]";

  const showsWork = $derived(chat.tab === "works" && !!chat.activeWork);
  const showsConversation = $derived(
    !chat.composing && chat.tab === "friends" && !!chat.activeId,
  );
  const paneOpen = $derived(showsWork || chat.composing || showsConversation);

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
  use:tabSwipe={(step) => {
    chat.tab = step > 0 ? "works" : "friends";
    if (step < 0) chat.activeId = null;
  }}
  aria-modal="true"
  aria-label={m.chat_title()}
  transition:fly={{ y: 24, duration: reduced ? 0 : 240 }}
  class="bg-surface fixed inset-0 z-50 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
  <div class="flex min-h-0 flex-1 flex-col" inert={paneOpen}>
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
          onclick={() => {
            // The tabs show from the list: a conversation still selected
            // from before (a work opened over it) mustn't open instead.
            chat.tab = "friends";
            chat.activeId = null;
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
          class="flex h-10 items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150
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
    </div>

    {#if chat.tab === "friends"}
      <div class="px-4 pb-1.5">
        <ChatSearchField bind:value={search} height="h-11 text-base" />
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
              {#if !search}<EmptyArt name="chat" class="h-20 w-28" />{/if}
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
      <ChatWorkList onselect={(work) => (chat.activeWork = work)} />
    {/if}
  </div>

  {#if showsWork}
    <div class={PANE} transition:fly={slide}>
      {#key `${chat.activeWork?.targetType}:${chat.activeWork?.targetId}`}
        <ChatWorkThread
          work={chat.activeWork!}
          mode="sheet"
          onback={() => (chat.activeWork = null)} />
      {/key}
    </div>
  {/if}
  {#if chat.composing}
    <div class={PANE} transition:fly={slide}>
      <ChatNewMessage
        mode="sheet"
        onopen={(id) => chat.select(id)}
        onback={() => chat.back()} />
    </div>
  {/if}
  {#if showsConversation}
    <div class={PANE} transition:fly={slide}>
      {#key chat.activeId}
        <ChatThread
          conversationId={chat.activeId!}
          mode="sheet"
          onback={() => chat.back()} />
      {/key}
    </div>
  {/if}
</div>
