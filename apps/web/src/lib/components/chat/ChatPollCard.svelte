<script lang="ts">
  import { votePoll } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { upsertMessage, type MessagePages } from "#lib/chat/chat-cache.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { MessageDto, MessagePollDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";

  let {
    message,
    poll,
    writable,
  }: {
    message: MessageDto;
    poll: MessagePollDto;
    /** Voting needs a conversation still open to writing. */
    writable: boolean;
  } = $props();

  const queryClient = useQueryClient();
  const total = $derived(
    poll.options.reduce((sum, option) => sum + option.voters.length, 0),
  );

  const voteMut = createApiMutation(() => ({
    mutate: (option: string) => votePoll(message.id, option),
    onSuccess: (updated) =>
      queryClient.setQueryData<MessagePages>(
        keys.chat.messages(message.conversationId),
        (data) => upsertMessage(data, updated),
      ),
    errorToast: true,
  }));
</script>

<div
  class="border-border bg-surface text-fg flex w-72 max-w-full flex-col gap-2 rounded-2xl border p-3">
  <p
    class="font-display text-[1.05rem] leading-snug font-extrabold text-balance">
    {poll.question}
  </p>
  {#each poll.options as option (option.id)}
    {@const share = total
      ? Math.round((option.voters.length / total) * 100)
      : 0}
    {@const mine = poll.myVote === option.id}
    <button
      type="button"
      class="relative flex w-full items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2 text-left text-sm font-semibold transition-colors duration-150 disabled:cursor-default
        {mine ? 'border-accent' : 'border-border enabled:hover:border-accent'}"
      aria-pressed={mine}
      disabled={!writable || voteMut.loading}
      onclick={() => voteMut.mutate(option.id)}>
      <span
        class="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out motion-reduce:transition-none
          {mine ? 'bg-accent/20' : 'bg-surface-2'}"
        style:width={`${share}%`}></span>
      {#if option.href}
        <span class="relative w-5 shrink-0 overflow-hidden rounded-sm">
          <Poster
            src={option.imageUrl}
            title={option.text}
            alt=""
            caption={false} />
        </span>
      {/if}
      <span class="relative min-w-0 flex-1 truncate">{option.text}</span>
      {#if option.voters.length > 0}
        <span class="relative flex gap-0.5" aria-hidden="true">
          {#each option.voters as voter (voter.id)}
            <Avatar seed={voter.username} url={voter.avatarUrl} size={20} />
          {/each}
        </span>
      {/if}
      <span class="text-dim relative font-mono text-xs font-bold tabular-nums">
        {share}%
      </span>
    </button>
  {/each}
  <p class="text-dim text-xs">
    {total === 1
      ? m.chat_poll_votes_one({ count: total })
      : m.chat_poll_votes_many({ count: total })}
  </p>
</div>
