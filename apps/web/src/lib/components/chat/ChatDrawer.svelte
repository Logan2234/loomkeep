<script lang="ts">
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { ConversationDto } from "@loomkeep/shared";
  import { fly } from "svelte/transition";
  import ChatConversationRow from "./ChatConversationRow.svelte";
  import ChatWorksSoon from "./ChatWorksSoon.svelte";

  let { conversations }: { conversations: ConversationDto[] } = $props();

  const reduced = prefersReducedMotion();
  let search = $state("");
  const shown = $derived(
    conversations.filter((c) =>
      (c.peer?.displayName ?? "")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ),
  );
</script>

<!-- Unfolds out of the panel's left edge, over the page: the conversation
     beside it stays readable. Only transform and opacity move. -->
<div
  transition:fly={{ x: 24, duration: reduced ? 0 : 200 }}
  class="border-border bg-bg absolute top-[-1px] right-full bottom-[-1px] flex w-[280px] flex-col gap-1 rounded-l-2xl border border-r-0 py-2.5 shadow-[-14px_18px_40px_-12px_rgb(0_0_0/0.45)]">
  <div class="flex items-center gap-1.5 pr-2 pl-3.5">
    <div role="tablist" class="bg-surface flex flex-1 gap-1 rounded-xl p-1">
      <button
        type="button"
        role="tab"
        aria-selected={chat.tab === "friends"}
        class="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors duration-150
          {chat.tab === 'friends' ? 'bg-surface-2 text-fg' : 'text-dim'}"
        onclick={() => (chat.tab = "friends")}>
        <Icon name="users" class="h-4 w-4" />
        {m.common_friends()}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={chat.tab === "works"}
        class="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors duration-150
          {chat.tab === 'works' ? 'bg-surface-2 text-fg' : 'text-dim'}"
        onclick={() => (chat.tab = "works")}>
        <Icon name="tv" class="h-4 w-4" />
        {m.common_works()}
      </button>
    </div>
    <button
      type="button"
      class="btn-icon"
      aria-label={m.chat_fold_list()}
      title={m.chat_fold_list()}
      onclick={() => (chat.drawer = false)}>
      <Icon name="chevron-right" class="h-4.5 w-4.5" />
    </button>
  </div>

  {#if chat.tab === "friends"}
    <div class="px-3 pt-1.5 pb-1">
      <label class="input flex h-9 items-center gap-2 py-0">
        <Icon name="search" class="text-dim h-4 w-4 shrink-0" />
        <span class="sr-only">{m.chat_search_friends()}</span>
        <input
          bind:value={search}
          class="min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder={m.chat_search_friends()} />
      </label>
    </div>
    <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5">
      {#each shown as conversation (conversation.id)}
        <ChatConversationRow
          {conversation}
          size={40}
          active={chat.activeId === conversation.id && !chat.composing}
          onselect={(id) => chat.select(id)} />
      {:else}
        <p class="text-dim px-3 py-4 text-center text-sm">
          {search ? m.common_no_results() : m.chat_no_conversation()}
        </p>
      {/each}
    </div>
    <button
      type="button"
      class="hover:bg-surface-2 text-accent mx-1.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150"
      onclick={() => chat.newMessage()}>
      <span
        class="border-border text-fg grid h-10 w-10 place-items-center rounded-full border border-dashed">
        <Icon name="plus" class="h-4.5 w-4.5" />
      </span>
      {m.chat_new_message()}
    </button>
  {:else}
    <ChatWorksSoon />
  {/if}
</div>
