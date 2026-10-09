<script lang="ts">
  import { getChatFriends, openConversation } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import ChatSearchField from "./ChatSearchField.svelte";
  import { useQueryClient } from "@tanstack/svelte-query";

  let {
    mode,
    onopen,
    onclose,
    onback,
  }: {
    mode: "panel" | "full" | "sheet";
    onopen: (conversationId: string) => void;
    onclose?: () => void;
    onback?: () => void;
  } = $props();

  const queryClient = useQueryClient();
  let search = $state("");
  let query = $state("");
  let timer: ReturnType<typeof setTimeout> | undefined;

  function oninput() {
    clearTimeout(timer);
    timer = setTimeout(() => (query = search.trim()), 250);
  }

  const friendsQuery = createApiQuery(() => ({
    key: keys.chat.friends(query),
    fetch: () => getChatFriends(query),
    keepPreviousData: true,
  }));

  const openMut = createApiMutation(() => ({
    mutate: (username: string) => openConversation(username),
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        keys.chat.conversation(conversation.id),
        conversation,
      );
      onopen(conversation.id);
    },
    errorToast: true,
  }));
</script>

<header
  class="border-border flex shrink-0 items-center gap-2 border-b py-2.5 pr-2.5
    {mode === 'sheet' ? 'pl-1' : 'pl-4'}">
  {#if mode === "sheet"}
    <button
      type="button"
      class="btn-icon h-11 w-11"
      aria-label={m.common_back()}
      onclick={onback}>
      <Icon name="chevron-left" class="h-5 w-5" />
    </button>
  {/if}
  <h2 class="min-w-0 flex-1 truncate font-semibold">{m.chat_new_message()}</h2>
  {#if mode === "panel"}
    <button
      type="button"
      class="btn-icon"
      aria-label={m.common_close()}
      onclick={onclose}>
      <Icon name="x" class="h-4.5 w-4.5" />
    </button>
  {/if}
</header>

<div class="px-4 pt-3 pb-1">
  <ChatSearchField bind:value={search} height="h-10" {oninput} />
  <p class="text-dim mt-2 text-xs">{m.chat_friends_only()}</p>
</div>

<ul class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
  {#each friendsQuery.data ?? [] as friend (friend.id)}
    <li>
      <button
        type="button"
        class="hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150"
        disabled={openMut.loading}
        onclick={() => openMut.mutate(friend.username)}>
        <Avatar seed={friend.username} url={friend.avatarUrl} size={40} />
        <span class="min-w-0">
          <span class="block truncate font-semibold">{friend.displayName}</span>
          <span class="text-dim block truncate text-xs"
            >@{friend.username}</span>
        </span>
      </button>
    </li>
  {:else}
    {#if !friendsQuery.loading}
      <li class="text-dim px-3 py-6 text-center text-sm">
        {query ? m.common_no_results() : m.chat_no_friends()}
      </li>
    {/if}
  {/each}
</ul>
