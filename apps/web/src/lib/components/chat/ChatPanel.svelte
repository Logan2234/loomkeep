<script lang="ts">
  import { goto } from "$app/navigation";
  import { getConversations } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { fly } from "svelte/transition";
  import ChatDrawer from "./ChatDrawer.svelte";
  import ChatNewMessage from "./ChatNewMessage.svelte";
  import ChatRail from "./ChatRail.svelte";
  import ChatThread from "./ChatThread.svelte";
  import ChatWorksSoon from "./ChatWorksSoon.svelte";

  const reduced = prefersReducedMotion();

  const conversationsQuery = createApiQuery(() => ({
    key: keys.chat.conversations(),
    fetch: () => getConversations(),
  }));
  const conversations = $derived(conversationsQuery.data?.items ?? []);

  function expand() {
    const id = chat.activeId;
    chat.close();
    if (id) void goto(`/app/messages/${id}`);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (chat.drawer) chat.drawer = false;
    else chat.close();
  }
</script>

<section
  aria-label={m.chat_title()}
  transition:fly={{ y: 10, duration: reduced ? 0 : 200, opacity: 0 }}
  {onkeydown}
  class="border-border bg-surface fixed right-6 bottom-[90px] z-40 flex h-[min(640px,calc(100dvh-120px))] w-[600px] rounded-2xl border shadow-2xl
    {chat.drawer ? 'rounded-l-none' : ''}"
  style="transform-origin: bottom right;">
  {#if chat.drawer}
    <ChatDrawer {conversations} />
  {/if}
  <ChatRail {conversations} />

  <div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-2xl">
    {#if chat.tab === "works"}
      <header
        class="border-border flex shrink-0 items-center gap-2 border-b py-2.5 pr-2.5 pl-4">
        <h2 class="min-w-0 flex-1 font-semibold">{m.common_works()}</h2>
        <button
          type="button"
          class="btn-icon"
          aria-label={m.common_close()}
          onclick={() => chat.close()}>
          <Icon name="x" class="h-4.5 w-4.5" />
        </button>
      </header>
      <ChatWorksSoon />
    {:else if chat.composing}
      <ChatNewMessage
        mode="panel"
        onopen={(id) => chat.select(id)}
        onclose={() => chat.close()} />
    {:else if chat.activeId}
      {#key chat.activeId}
        <ChatThread
          conversationId={chat.activeId}
          mode="panel"
          onclose={() => chat.close()}
          onexpand={expand} />
      {/key}
    {:else}
      <div
        class="text-dim flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Icon name="message" class="h-8 w-8" />
        <p class="font-display text-fg text-lg font-extrabold">
          {m.chat_title()}
        </p>
        <p class="max-w-[32ch] text-sm">{m.chat_pick_conversation()}</p>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onclick={() => chat.newMessage()}>
          {m.chat_new_message()}
        </button>
      </div>
    {/if}
  </div>
</section>
