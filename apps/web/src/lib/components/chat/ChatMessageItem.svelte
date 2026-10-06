<script lang="ts">
  import {
    deleteMessage,
    reactToMessage,
    unreactToMessage,
  } from "#lib/api/chat.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    COMMENT_EMOTE_DISPLAY,
    type CommentEmote,
    type MessageDto,
  } from "@loomkeep/shared";
  import { fade, scale } from "svelte/transition";
  import ChatMessageText from "./ChatMessageText.svelte";

  let {
    message,
    writable,
    endOfGroup,
    time,
    seenAt = null,
    onedit,
    onreport,
  }: {
    message: MessageDto;
    /** Reacting needs a conversation still open to writing. */
    writable: boolean;
    endOfGroup: boolean;
    time: string;
    /** Set under the viewer's last message once the other member read it. */
    seenAt?: string | null;
    onedit: (message: MessageDto) => void;
    onreport: (message: MessageDto) => void;
  } = $props();

  const reduced = prefersReducedMotion();
  let picking = $state(false);
  let confirmingDelete = $state(false);
  let wallRevealed = $state(false);

  const reactMut = createApiMutation(() => ({
    mutate: (emote: CommentEmote) =>
      message.myReaction === emote
        ? unreactToMessage(message.id)
        : reactToMessage(message.id, emote),
    errorToast: true,
  }));

  const deleteMut = createApiMutation(() => ({
    mutate: () => deleteMessage(message.id),
    onSuccess: () => (confirmingDelete = false),
    errorToast: true,
  }));

  function react(emote: CommentEmote) {
    picking = false;
    reactMut.mutate(emote);
  }

  const hasActions = $derived(!message.deleted && (writable || !message.mine));
</script>

<div
  class="group relative flex max-w-[78%] flex-col
    {message.mine ? 'items-end self-end' : 'items-start self-start'}"
  data-message-id={message.id}>
  {#if hasActions}
    <div
      class="border-border bg-surface absolute -top-4 z-10 flex gap-0.5 rounded-lg border p-0.5 opacity-0 shadow-md transition-[opacity,transform] duration-150 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none
        {message.mine ? '-left-3' : '-right-3'}
        {picking ? 'opacity-100' : ''}">
      {#if writable}
        <button
          type="button"
          class="btn-icon h-7 w-7"
          aria-label={m.common_react()}
          aria-expanded={picking}
          onclick={() => (picking = !picking)}>
          <Icon name="sparkles" class="h-4 w-4" />
        </button>
      {/if}
      {#if message.mine && writable}
        <button
          type="button"
          class="btn-icon h-7 w-7"
          aria-label={m.common_edit()}
          onclick={() => onedit(message)}>
          <Icon name="edit" class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="btn-icon h-7 w-7"
          aria-label={m.common_delete()}
          onclick={() => (confirmingDelete = true)}>
          <Icon name="trash" class="h-4 w-4" />
        </button>
      {/if}
      {#if !message.mine}
        <button
          type="button"
          class="btn-icon h-7 w-7"
          aria-label={m.common_report()}
          onclick={() => onreport(message)}>
          <Icon name="flag" class="h-4 w-4" />
        </button>
      {/if}
    </div>
  {/if}

  {#if picking}
    <div
      transition:scale={{ duration: reduced ? 0 : 150, start: 0.95 }}
      role="group"
      aria-label={m.common_react()}
      class="border-border bg-surface absolute bottom-full z-20 mb-5 flex gap-0.5 rounded-full border p-1 shadow-lg
        {message.mine ? 'right-0' : 'left-0'}">
      {#each Object.entries(COMMENT_EMOTE_DISPLAY) as [emote, glyph] (emote)}
        <button
          type="button"
          class="hover:bg-surface-2 grid h-8 w-8 place-items-center rounded-full text-lg transition-transform duration-150 hover:scale-110 motion-reduce:transition-none
            {message.myReaction === emote ? 'bg-accent/20' : ''}"
          aria-pressed={message.myReaction === emote}
          onclick={() => react(emote as CommentEmote)}>
          {glyph}
        </button>
      {/each}
    </div>
  {/if}

  {#if message.deleted}
    <p
      class="border-border text-dim rounded-2xl border border-dashed px-3 py-2 text-sm italic">
      {message.deletedByAdmin
        ? m.chat_message_removed_by_admin()
        : m.chat_message_deleted()}
    </p>
  {:else if message.spoiler && !wallRevealed}
    <button
      type="button"
      class="text-fg flex items-center gap-2 rounded-2xl bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--accent)_22%,transparent)_0_8px,var(--surface-2)_8px_16px)] px-3.5 py-2.5 text-sm font-semibold transition-[filter] duration-150
        hover:brightness-110
        {message.mine ? 'rounded-br-md' : 'rounded-bl-md'}"
      onclick={() => (wallRevealed = true)}>
      <Icon name="eye-off" class="h-4 w-4" />
      {m.chat_spoiler_reveal()}
    </button>
  {:else}
    <p
      in:fade={{ duration: reduced ? 0 : 150 }}
      class="rounded-2xl px-3 py-2 text-sm leading-relaxed
        {message.mine
        ? 'bg-accent/20 text-fg rounded-br-md'
        : 'bg-surface-2 rounded-bl-md'}">
      <ChatMessageText text={message.text ?? ""} />
    </p>
  {/if}

  {#if message.reactions.length > 0}
    <div class="mt-1 flex flex-wrap gap-1">
      {#each message.reactions as reaction (reaction.emote)}
        <button
          type="button"
          disabled={!writable}
          class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors duration-150
            {message.myReaction === reaction.emote
            ? 'border-accent bg-accent/15'
            : 'border-border bg-surface'}"
          aria-pressed={message.myReaction === reaction.emote}
          onclick={() => react(reaction.emote)}>
          {COMMENT_EMOTE_DISPLAY[reaction.emote]}
          <span class="font-mono font-bold">{reaction.count}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if endOfGroup && !message.deleted}
    <p class="text-dim mx-1 mt-1 font-mono text-[0.68rem]">
      {message.edited ? `${time} · ${m.chat_edited()}` : time}
    </p>
  {/if}

  {#if seenAt}
    <p
      transition:fade={{ duration: reduced ? 0 : 150 }}
      class="text-dim mt-0.5 flex items-center gap-1 text-[0.7rem]">
      <Icon name="check" class="text-accent h-3.5 w-3.5" />
      {m.chat_seen_at({ time: seenAt })}
    </p>
  {/if}

  {#if confirmingDelete}
    <div
      transition:fade={{ duration: reduced ? 0 : 150 }}
      class="border-border bg-surface mt-1.5 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs">
      {m.chat_delete_confirm()}
      <button
        type="button"
        class="btn btn-danger btn-sm"
        disabled={deleteMut.loading}
        onclick={() => deleteMut.mutate()}>
        {m.common_delete()}
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        onclick={() => (confirmingDelete = false)}>
        {m.common_cancel()}
      </button>
    </div>
  {/if}
</div>
