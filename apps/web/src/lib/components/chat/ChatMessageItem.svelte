<script lang="ts">
  import {
    deleteMessage,
    markUnreadFrom,
    pinMessage,
    reactToMessage,
    unreactToMessage,
  } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import Drawer from "#lib/components/Drawer.svelte";
  import Dropdown from "#lib/components/Dropdown.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import {
    COMMENT_EMOTE_DISPLAY,
    type CommentEmote,
    type MessageDto,
  } from "@loomkeep/shared";
  import { fade } from "svelte/transition";
  import ChatForwardModal from "./ChatForwardModal.svelte";
  import ChatMessageText from "./ChatMessageText.svelte";
  import ChatWorkCard from "./ChatWorkCard.svelte";

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
  const LONG_PRESS_MS = 450;
  let confirmingDelete = $state(false);
  let wallRevealed = $state(false);
  // The phone's long-press sheet, standing in for the hover pills.
  let sheetOpen = $state(false);
  let forwarding = $state(false);
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let pressStart: { x: number; y: number } | null = null;

  const reactMut = createApiMutation(() => ({
    mutate: (emote: CommentEmote) =>
      message.myReaction === emote
        ? unreactToMessage(message.id)
        : reactToMessage(message.id, emote),
    errorToast: true,
  }));

  const deleteMut = createApiMutation(() => ({
    mutate: () => deleteMessage(message.id),
    onSuccess: () => {
      confirmingDelete = false;
      sheetOpen = false;
    },
    errorToast: true,
  }));

  const pinMut = createApiMutation(() => ({
    mutate: () => pinMessage(message.id, !message.pinned),
    invalidates: [keys.chat.pins(message.conversationId)],
    errorToast: true,
  }));

  const unreadMut = createApiMutation(() => ({
    mutate: () => markUnreadFrom(message.id),
    invalidates: [keys.chat.conversations(), keys.chat.unread()],
    successToast: m.chat_marked_unread(),
    errorToast: true,
  }));

  const hasActions = $derived(!message.deleted && (writable || !message.mine));
  const EMOTES = Object.entries(COMMENT_EMOTE_DISPLAY) as [
    CommentEmote,
    string,
  ][];

  function react(emote: CommentEmote) {
    sheetOpen = false;
    reactMut.mutate(emote);
  }

  async function copyText() {
    sheetOpen = false;
    try {
      await navigator.clipboard.writeText(message.text ?? "");
      toast.success(m.chat_text_copied());
    } catch {
      toast.error(m.chat_copy_failed());
    }
  }

  function openSheet() {
    confirmingDelete = false;
    sheetOpen = true;
  }

  function onpointerdown(event: PointerEvent) {
    if (!layout.compact || !hasActions || event.pointerType === "mouse") return;
    pressStart = { x: event.clientX, y: event.clientY };
    pressTimer = setTimeout(openSheet, LONG_PRESS_MS);
  }

  // A scroll isn't a press.
  function onpointermove(event: PointerEvent) {
    if (!pressStart) return;
    const moved =
      Math.abs(event.clientX - pressStart.x) +
      Math.abs(event.clientY - pressStart.y);
    if (moved > 10) cancelPress();
  }

  function cancelPress() {
    clearTimeout(pressTimer);
    pressStart = null;
  }

  function oncontextmenu(event: MouseEvent) {
    // Android turns a long press into a context menu: the sheet replaces it.
    if (layout.compact && hasActions) event.preventDefault();
  }
</script>

{#snippet emotePicker(onpicked: () => void)}
  <div class="flex gap-0.5" role="group" aria-label={m.common_react()}>
    {#each EMOTES as [emote, glyph] (emote)}
      <button
        type="button"
        class="hover:bg-surface-2 grid h-9 w-9 place-items-center rounded-full text-lg transition-[transform,background-color] duration-150 hover:scale-110 motion-reduce:transition-none
          {message.myReaction === emote ? 'bg-accent/20' : ''}"
        aria-pressed={message.myReaction === emote}
        onclick={() => {
          onpicked();
          react(emote);
        }}>
        {glyph}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet deleteConfirm(oncancel: () => void)}
  <div
    in:fade={{ duration: reduced ? 0 : 150 }}
    class="flex flex-col gap-2 px-2.5 py-2 text-sm">
    <p class="font-semibold">{m.chat_delete_confirm()}</p>
    <p class="text-dim text-xs">{m.chat_delete_confirm_hint()}</p>
    <div class="flex gap-2">
      <button
        type="button"
        class="btn btn-danger btn-sm"
        disabled={deleteMut.loading}
        onclick={() => deleteMut.mutate()}>
        {m.common_delete()}
      </button>
      <button type="button" class="btn btn-ghost btn-sm" onclick={oncancel}>
        {m.common_cancel()}
      </button>
    </div>
  </div>
{/snippet}

{#snippet actionItems(close: () => void)}
  {#if message.mine && writable && message.text}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        onedit(message);
      }}>
      <Icon name="edit" class="h-4 w-4" />
      {m.common_edit()}
    </button>
  {/if}
  {#if message.text && !message.spoiler}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        void copyText();
      }}>
      <Icon name="copy" class="h-4 w-4" />
      {m.chat_copy_text()}
    </button>
  {/if}
  <button
    role="menuitem"
    class="menu-item"
    onclick={() => {
      close();
      forwarding = true;
    }}>
    <Icon name="forward" class="h-4 w-4" />
    {m.chat_forward_ellipsis()}
  </button>
  {#if writable}
    <button
      role="menuitem"
      class="menu-item"
      disabled={pinMut.loading}
      onclick={() => {
        close();
        pinMut.mutate();
      }}>
      <Icon name={message.pinned ? "pin-filled" : "pin"} class="h-4 w-4" />
      {message.pinned ? m.chat_unpin() : m.chat_pin()}
    </button>
  {/if}
  {#if !message.mine}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        unreadMut.mutate();
      }}>
      <Icon name="mark-unread" class="h-4 w-4" />
      {m.chat_mark_unread()}
    </button>
  {/if}
  {#if message.mine && writable}
    <button
      role="menuitem"
      class="menu-item menu-item-danger border-border border-t"
      onclick={() => (confirmingDelete = true)}>
      <Icon name="trash" class="h-4 w-4" />
      {m.chat_delete_ellipsis()}
    </button>
  {/if}
  {#if !message.mine}
    <button
      role="menuitem"
      class="menu-item menu-item-danger border-border border-t"
      onclick={() => {
        close();
        onreport(message);
      }}>
      <Icon name="flag" class="h-4 w-4" />
      {m.common_report()}
    </button>
  {/if}
{/snippet}

<div
  class="group relative flex max-w-[78%] flex-col
    {message.mine ? 'items-end self-end' : 'items-start self-start'}"
  data-message-id={message.id}>
  {#if message.forwarded && !message.deleted}
    <p class="text-dim mx-1 mb-0.5 flex items-center gap-1 text-[0.7rem]">
      <Icon name="forward" class="h-3 w-3" />
      {m.chat_forwarded()}
    </p>
  {/if}
  <!-- The pills sit beside the bubble, on the conversation's side: they
       never cover its text nor the message above. -->
  <div
    class="flex max-w-full items-center gap-1.5
      {message.mine ? 'flex-row-reverse' : ''}">
    <div
      class="min-w-0 {layout.compact
        ? 'select-none [-webkit-touch-callout:none]'
        : ''}"
      role="presentation"
      {onpointerdown}
      {onpointermove}
      onpointerup={cancelPress}
      onpointercancel={cancelPress}
      {oncontextmenu}>
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
        <div
          in:fade={{ duration: reduced ? 0 : 150 }}
          class="flex flex-col gap-1.5 rounded-2xl text-sm leading-relaxed transition-shadow duration-150
            {message.text ? 'px-3 py-2' : 'p-1.5'}
            {message.mine
            ? 'bg-accent/20 text-fg rounded-br-md'
            : 'bg-surface-2 rounded-bl-md'}
            {sheetOpen ? 'ring-accent ring-2' : ''}">
          {#if message.text}
            <ChatMessageText
              text={message.text}
              cardHrefs={message.works.map((work) => work.href)} />
          {/if}
          {#each message.works as work (work.href)}
            <div in:fade={{ duration: reduced ? 0 : 150 }}>
              <ChatWorkCard {work} />
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if hasActions && !layout.compact}
      <div
        class="flex shrink-0 gap-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100">
        {#if writable}
          <Dropdown
            placement={message.mine ? "bottom-end" : "bottom-start"}
            role="presentation"
            class="rounded-full! p-1!">
            {#snippet trigger({ open, toggle, onkeydown })}
              <button
                type="button"
                class="border-border bg-surface text-dim hover:text-fg grid h-7 w-7 place-items-center rounded-full border transition-colors duration-150"
                aria-label={m.common_react()}
                aria-haspopup="true"
                aria-expanded={open}
                {onkeydown}
                onclick={toggle}>
                <Icon name="smile" class="h-4 w-4" />
              </button>
            {/snippet}
            {#snippet children({ close })}
              {@render emotePicker(close)}
            {/snippet}
          </Dropdown>
        {/if}
        <Dropdown
          placement={message.mine ? "bottom-end" : "bottom-start"}
          class="min-w-52">
          {#snippet trigger({ open, toggle, onkeydown })}
            <button
              type="button"
              class="border-border bg-surface text-dim hover:text-fg grid h-7 w-7 place-items-center rounded-full border transition-colors duration-150"
              aria-label={m.common_more_actions()}
              aria-haspopup="menu"
              aria-expanded={open}
              {onkeydown}
              onclick={(event) => {
                confirmingDelete = false;
                toggle(event);
              }}>
              <Icon name="dots-horizontal" class="h-4 w-4" />
            </button>
          {/snippet}
          {#snippet children({ close })}
            {#if confirmingDelete}
              {@render deleteConfirm(() => {
                confirmingDelete = false;
                close();
              })}
            {:else}
              {@render actionItems(close)}
            {/if}
          {/snippet}
        </Dropdown>
      </div>
    {/if}
  </div>

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
    <p
      class="text-dim mx-1 mt-1 flex items-center gap-1 font-mono text-[0.68rem]">
      {#if message.pinned}
        <Icon name="pin-filled" class="text-accent h-3 w-3" />
        <span class="sr-only">{m.chat_pinned()}</span>
      {/if}
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
</div>

{#if sheetOpen}
  <!-- Above the Messages sheet (z-50). -->
  <Drawer onclose={() => (sheetOpen = false)} zIndex={60}>
    <div class="flex flex-col gap-2 px-3 pt-1 pb-3">
      {#if writable && !confirmingDelete}
        <div class="self-center">
          {@render emotePicker(() => {})}
        </div>
      {/if}
      <div class="flex flex-col" role="menu">
        {#if confirmingDelete}
          {@render deleteConfirm(() => (confirmingDelete = false))}
        {:else}
          {@render actionItems(() => (sheetOpen = false))}
        {/if}
      </div>
    </div>
  </Drawer>
{/if}

{#if forwarding}
  <ChatForwardModal {message} onclose={() => (forwarding = false)} />
{/if}
