<script lang="ts">
  import { goto } from "$app/navigation";
  import { getConversations, getWorkThreads } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { fly } from "svelte/transition";
  import ChatNewMessage from "./ChatNewMessage.svelte";
  import ChatRail from "./ChatRail.svelte";
  import ChatThread from "./ChatThread.svelte";
  import ChatWorksEmpty from "./ChatWorksEmpty.svelte";
  import ChatWorkThread from "./ChatWorkThread.svelte";
  import {
    conversationStep,
    neighbourConversation,
    shortcutsReach,
  } from "./conversation-presentation";

  const reduced = prefersReducedMotion();

  const conversationsQuery = createApiQuery(() => ({
    key: keys.chat.conversations(),
    fetch: () => getConversations(),
  }));
  const conversations = $derived(conversationsQuery.data?.items ?? []);

  const threadsQuery = createApiQuery(() => ({
    key: keys.chat.workThreads(),
    fetch: getWorkThreads,
  }));
  const threads = $derived(threadsQuery.data ?? []);

  function expand() {
    const id = chat.activeId;
    chat.close();
    if (chat.tab === "works") void goto("/app/messages");
    else if (id) void goto(`/app/messages/${id}`);
  }

  let panel = $state<HTMLElement | null>(null);

  // Alt+↑/↓ moves between conversations wherever the focus sits, as long as
  // it isn't typing elsewhere. Escape folds the list, then closes the panel
  // — only from inside it, and after the composer and the menus handled
  // theirs.
  function onkeydown(event: KeyboardEvent) {
    const step = conversationStep(event);
    if (step && chat.tab === "friends" && shortcutsReach(panel)) {
      const next = neighbourConversation(conversations, chat.activeId, step);
      if (next) {
        event.preventDefault();
        chat.select(next);
      }
      return;
    }

    if (!panel?.contains(document.activeElement)) return;
    if (event.key !== "Escape" || event.defaultPrevented) return;
    // A menu listens on the window too, after the panel: it closes first.
    if (panel.querySelector('[aria-haspopup][aria-expanded="true"]')) return;
    if (chat.drawer) chat.drawer = false;
    else chat.close();
  }
</script>

<svelte:window {onkeydown} />

{#snippet tabHeader(title: string)}
  <header
    class="border-border flex shrink-0 items-center gap-2 border-b py-2.5 pr-2.5 pl-4">
    <h2 class="min-w-0 flex-1 font-semibold">{title}</h2>
    <button
      type="button"
      class="btn-icon"
      aria-label={m.common_close()}
      onclick={() => chat.close()}>
      <Icon name="x" class="h-4.5 w-4.5" />
    </button>
  </header>
{/snippet}

<section
  bind:this={panel}
  aria-label={m.chat_title()}
  transition:fly={{ y: 10, duration: reduced ? 0 : 200, opacity: 0 }}
  class="border-border bg-surface fixed right-6 bottom-[90px] z-40 flex h-[min(640px,calc(100dvh-120px))] max-w-[calc(100vw-3rem)] rounded-2xl border shadow-2xl transition-[width] duration-200 ease-out motion-reduce:transition-none
    {chat.drawer ? 'w-[808px]' : 'w-[600px]'}"
  style="transform-origin: bottom right;">
  <ChatRail {conversations} {threads} />

  <div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-2xl">
    {#if chat.tab === "works" && chat.activeWork}
      {#key `${chat.activeWork.targetType}:${chat.activeWork.targetId}`}
        <ChatWorkThread
          work={chat.activeWork}
          mode="panel"
          onclose={() => chat.close()}
          onexpand={expand} />
      {/key}
    {:else if chat.tab === "works"}
      {@render tabHeader(m.common_works())}
      {#if threads.length > 0}
        <div
          class="text-dim flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Icon name="tv" class="h-8 w-8" />
          <p class="max-w-[32ch] text-sm">{m.chat_works_pick()}</p>
        </div>
      {:else if !threadsQuery.loading}
        <ChatWorksEmpty />
      {/if}
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
      {@render tabHeader(m.common_friends())}
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
