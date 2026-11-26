<script lang="ts">
  import { goto } from "$app/navigation";
  import { getConversations, getWorkThreads } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { fly } from "svelte/transition";
  import ChatNewMessage from "./ChatNewMessage.svelte";
  import ChatRail from "./ChatRail.svelte";
  import ChatThread from "./ChatThread.svelte";
  import ChatWorksEmpty from "./ChatWorksEmpty.svelte";
  import ChatWorkThread from "./ChatWorkThread.svelte";
  import InviteFriendModal from "./InviteFriendModal.svelte";
  import {
    conversationStep,
    escapeReaches,
    neighbourConversation,
    neighbourWork,
    shortcutsReach,
  } from "./conversation-presentation";

  const reduced = prefersReducedMotion();

  let inviting = $state(false);
  const canInvite = $derived(appConfig.registrationEnabled);

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
  // it isn't typing elsewhere. Escape folds the list, then closes the panel,
  // after the composer, the menus and the page's own dialogs had theirs.
  function onkeydown(event: KeyboardEvent) {
    const step = conversationStep(event);
    if (step && shortcutsReach(panel)) {
      if (chat.tab === "friends") {
        const next = neighbourConversation(conversations, chat.activeId, step);
        if (next) {
          event.preventDefault();
          chat.select(next);
        }
      } else {
        const next = neighbourWork(threads, chat.activeWork, step);
        if (next) {
          event.preventDefault();
          chat.showWork(next);
        }
      }
      return;
    }

    if (event.key !== "Escape" || event.defaultPrevented) return;
    // A menu listens on the window too, after the panel: it closes first.
    if (!escapeReaches(panel)) return;
    if (chat.drawer) chat.drawer = false;
    else chat.close();
  }
</script>

<svelte:window {onkeydown} />

{#snippet tabHeader(title: string, invite = false)}
  <header
    class="border-border flex shrink-0 items-center gap-2 border-b py-2.5 pr-2.5 pl-4">
    <h2 class="min-w-0 flex-1 font-semibold">{title}</h2>
    {#if invite}
      <button
        type="button"
        class="btn-icon"
        aria-label={m.chat_invite()}
        title={m.chat_invite()}
        onclick={() => (inviting = true)}>
        <Icon name="user-plus" class="h-4.5 w-4.5" />
      </button>
    {/if}
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
      {@render tabHeader(m.common_friends(), canInvite)}
      <div
        class="text-dim flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Icon name="message" class="h-8 w-8" />
        <p class="font-display text-fg text-lg font-extrabold">
          {m.chat_title()}
        </p>
        <p class="max-w-[32ch] text-sm">{m.chat_pick_conversation()}</p>
        <div class="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            onclick={() => chat.newMessage()}>
            {m.chat_new_message()}
          </button>
          {#if canInvite}
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              onclick={() => (inviting = true)}>
              <Icon name="user-plus" class="h-4 w-4" />
              {m.chat_invite_title()}
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</section>

{#if inviting}
  <InviteFriendModal onclose={() => (inviting = false)} />
{/if}
