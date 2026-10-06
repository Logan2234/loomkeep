<script lang="ts">
  import {
    getConversation,
    getMessages,
    markConversationRead,
    muteConversation,
    reportMessage,
  } from "#lib/api/chat.js";
  import { createApiInfiniteQuery } from "#lib/api/infinite-query.svelte.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chronological, seenMessageId } from "#lib/chat/chat-cache.js";
  import { chatPreview } from "#lib/chat/chat-markdown.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Dropdown from "#lib/components/Dropdown.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import ReportModal from "#lib/components/ReportModal.svelte";
  import { formatDate, formatTime } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import { localDayKey } from "#lib/xp-history.js";
  import type {
    ConversationDto,
    MessageDto,
    PagedResult,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import ChatComposer from "./ChatComposer.svelte";
  import ChatMessageItem from "./ChatMessageItem.svelte";

  let {
    conversationId,
    mode,
    onclose,
    onexpand,
    onshrink,
    onback,
  }: {
    conversationId: string;
    /** The floating panel, the full-screen page or the compact sheet. */
    mode: "panel" | "full" | "sheet";
    onclose?: () => void;
    onexpand?: () => void;
    onshrink?: () => void;
    onback?: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
  const queryClient = useQueryClient();

  const conversationQuery = createApiQuery(() => ({
    key: keys.chat.conversation(conversationId),
    fetch: () => getConversation(conversationId),
  }));
  const conversation = $derived(conversationQuery.data);

  const messagesQuery = createApiInfiniteQuery(() => ({
    key: keys.chat.messages(conversationId),
    fetch: (page: number) => getMessages(conversationId, page),
    getPageItems: (page: PagedResult<MessageDto>) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last: PagedResult<MessageDto>, all) =>
      last.hasMore ? all.length + 1 : undefined,
  }));
  const messages = $derived(chronological(messagesQuery.pages));

  const peer = $derived(conversation?.peer ?? null);
  const peerName = $derived(peer?.displayName ?? m.chat_deleted_account());
  const online = $derived(
    conversation?.peerOnline === null || !peer
      ? null
      : (chat.presence[peer.id] ?? conversation?.peerOnline ?? null),
  );
  const writable = $derived(!!conversation && conversation.readOnly === null);
  const seenId = $derived(
    seenMessageId(messages, conversation?.peerLastReadAt ?? null),
  );
  const typing = $derived(
    online !== null && writable && !!chat.typing[conversationId],
  );

  let editing = $state<MessageDto | null>(null);
  let reporting = $state<MessageDto | null>(null);
  let scroller = $state<HTMLDivElement | null>(null);
  let topSentinel = $state<HTMLDivElement | null>(null);
  let stuckToBottom = true;

  type Entry =
    | { kind: "day"; key: string; label: string }
    | {
        kind: "message";
        message: MessageDto;
        endOfGroup: boolean;
        gap: boolean;
      };

  function dayLabel(iso: string): string {
    const day = localDayKey(new Date(iso));
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (day === localDayKey(today)) return m.common_today();
    if (day === localDayKey(yesterday)) return m.common_yesterday();
    return formatDate(iso, { day: "numeric", month: "long" });
  }

  const entries = $derived.by(() => {
    const out: Entry[] = [];
    let lastDay: string | null = null;

    messages.forEach((message, i) => {
      const day = localDayKey(new Date(message.createdAt));
      if (day !== lastDay) {
        out.push({ kind: "day", key: day, label: dayLabel(message.createdAt) });
        lastDay = day;
      }
      const prev = messages[i - 1];
      const next = messages[i + 1];
      out.push({
        kind: "message",
        message,
        gap: !!prev && prev.mine !== message.mine,
        endOfGroup:
          !next ||
          next.mine !== message.mine ||
          localDayKey(new Date(next.createdAt)) !== day,
      });
    });

    return out;
  });

  // Keeps the newest message in view as messages arrive, unless the reader
  // scrolled up to read older ones.
  $effect(() => {
    void messages.length;
    void typing;
    if (!scroller || !stuckToBottom) return;
    const el = scroller;
    void tick().then(() => (el.scrollTop = el.scrollHeight));
  });

  function onscroll() {
    if (!scroller) return;
    stuckToBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
  }

  // Older pages load when the top comes into view; the scroll position is
  // kept on the message that was on screen.
  let restoreFrom: number | null = null;

  $effect(() => {
    if (!topSentinel || !scroller) return;
    const el = scroller;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !messagesQuery.hasNextPage) return;
        if (messagesQuery.isFetchingNextPage) return;
        restoreFrom = el.scrollHeight;
        messagesQuery.fetchNextPage();
      },
      { root: el },
    );
    observer.observe(topSentinel);
    return () => observer.disconnect();
  });

  $effect(() => {
    void messagesQuery.pages.length;
    if (restoreFrom === null || !scroller) return;
    const el = scroller;
    const before = restoreFrom;
    restoreFrom = null;
    void tick().then(() => (el.scrollTop += el.scrollHeight - before));
  });

  // Read as soon as it's on screen: on opening, and as messages arrive.
  let readUpTo: string | null = null;
  $effect(() => {
    const last = messages.at(-1);
    if (!conversation || !last || last.id === readUpTo) return;
    if (last.mine && conversation.unread === 0) return;
    readUpTo = last.id;

    void markConversationRead(conversationId).then(() => {
      const clear = (c: ConversationDto) => ({ ...c, unread: 0 });
      queryClient.setQueryData<ConversationDto>(
        keys.chat.conversation(conversationId),
        (c) => c && clear(c),
      );
      queryClient.setQueryData<PagedResult<ConversationDto>>(
        keys.chat.conversations(),
        (list) =>
          list && {
            ...list,
            items: list.items.map((c) =>
              c.id === conversationId ? clear(c) : c,
            ),
          },
      );
      void queryClient.invalidateQueries({ queryKey: keys.chat.unread() });
    });
  });

  $effect(() => {
    if (mode !== "full") return;
    chat.fullscreenId = conversationId;
    return () => {
      if (chat.fullscreenId === conversationId) chat.fullscreenId = null;
    };
  });

  const muteMut = createApiMutation(() => ({
    mutate: (muted: boolean) => muteConversation(conversationId, muted),
    invalidates: [
      keys.chat.conversation(conversationId),
      keys.chat.conversations(),
      keys.chat.unread(),
    ],
    errorToast: true,
  }));

  const reportMut = createApiMutation(() => ({
    mutate: (vars: Parameters<typeof reportMessage>) => reportMessage(...vars),
    onSuccess: () => {
      reporting = null;
      toast.success(m.chat_reported());
    },
    errorToast: true,
  }));

  const readOnlyNotice = $derived(
    conversation?.readOnly === "unfollowed"
      ? m.chat_read_only_unfollowed()
      : conversation?.readOnly === "blocked"
        ? m.chat_read_only_blocked()
        : conversation?.readOnly === "deleted"
          ? m.chat_read_only_deleted()
          : null,
  );
</script>

<!-- On the full-screen page, the notification bell is fixed in the same
     top-right corner: the header leaves it room. -->
<header
  class="border-border flex shrink-0 items-center gap-2.5 border-b py-2.5
    {mode === 'sheet' ? 'pl-1' : 'pl-4'}
    {mode === 'full' ? 'pr-20' : 'pr-2.5'}">
  {#if mode === "sheet"}
    <button
      type="button"
      class="btn-icon h-11 w-11"
      aria-label={m.common_back()}
      onclick={onback}>
      <Icon name="chevron-left" class="h-5 w-5" />
    </button>
  {/if}
  {#if mode !== "panel"}
    <span class="relative">
      <Avatar seed={peer?.username ?? "?"} url={peer?.avatarUrl} size={38} />
      {#if online}
        <span
          class="bg-success ring-surface absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2"
        ></span>
      {/if}
    </span>
  {/if}
  <div class="min-w-0 flex-1">
    <p
      class="flex items-center gap-1.5 truncate font-semibold
        {mode === 'full' ? 'font-display text-xl font-extrabold' : ''}">
      {#if peer}
        <a href="/app/u/{peer.username}" class="truncate hover:underline"
          >{peerName}</a>
      {:else}
        <span class="truncate">{peerName}</span>
      {/if}
      {#if conversation?.muted}
        <Icon name="bell-off" class="text-dim h-3.5 w-3.5 shrink-0" />
      {/if}
    </p>
    {#if conversation?.readOnly === "unfollowed"}
      <p class="text-dim text-xs">{m.chat_read_only()}</p>
    {:else if online}
      <p
        class="text-success text-xs"
        transition:fade={{ duration: reduced ? 0 : 150 }}>
        {m.common_online()}
      </p>
    {/if}
  </div>

  {#if conversation && conversation.readOnly !== "deleted"}
    <Dropdown placement="bottom-end" class="min-w-52">
      {#snippet trigger({ open, toggle, onkeydown })}
        <button
          type="button"
          class="btn-icon"
          aria-label={m.common_more_actions()}
          aria-haspopup="menu"
          aria-expanded={open}
          {onkeydown}
          onclick={toggle}>
          <Icon name="dots-horizontal" class="h-4.5 w-4.5" />
        </button>
      {/snippet}
      {#snippet children({ close })}
        {#if peer}
          <a role="menuitem" class="menu-item" href="/app/u/{peer.username}">
            <Icon name="user" class="h-4 w-4" />
            {m.chat_view_profile()}
          </a>
        {/if}
        <button
          role="menuitem"
          class="menu-item"
          onclick={() => {
            close();
            muteMut.mutate(!conversation.muted);
          }}>
          <Icon
            name={conversation.muted ? "bell" : "bell-off"}
            class="h-4 w-4" />
          {conversation.muted ? m.chat_unmute() : m.chat_mute()}
        </button>
      {/snippet}
    </Dropdown>
  {/if}

  {#if mode === "panel"}
    <button
      type="button"
      class="btn-icon"
      aria-label={m.chat_fullscreen()}
      title={m.chat_fullscreen()}
      onclick={onexpand}>
      <Icon name="resize" class="h-4.5 w-4.5" />
    </button>
    <button
      type="button"
      class="btn-icon"
      aria-label={m.common_close()}
      onclick={onclose}>
      <Icon name="x" class="h-4.5 w-4.5" />
    </button>
  {:else if mode === "full"}
    <button type="button" class="btn btn-ghost btn-sm" onclick={onshrink}>
      <Icon name="resize" class="h-4 w-4" />
      {m.common_collapse()}
    </button>
  {/if}
</header>

<div
  bind:this={scroller}
  {onscroll}
  class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-3
    {mode === 'full' ? 'px-8' : 'px-4'}">
  <div bind:this={topSentinel} class="h-px shrink-0"></div>
  {#if messagesQuery.isFetchingNextPage}
    <p class="text-dim self-center text-xs">{m.common_loading()}</p>
  {/if}
  <div class="flex-1"></div>

  {#if !messagesQuery.loading && messages.length === 0}
    <p class="text-dim self-center py-6 text-center text-sm">
      {m.chat_empty_conversation({ name: peerName })}
    </p>
  {/if}

  {#each entries as entry (entry.kind === "day" ? entry.key : entry.message.id)}
    {#if entry.kind === "day"}
      <p
        class="border-border text-dim my-2 self-center rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] tracking-wider uppercase">
        {entry.label}
      </p>
    {:else}
      <div class="flex flex-col {entry.gap ? 'mt-2' : ''}">
        <ChatMessageItem
          message={entry.message}
          {writable}
          endOfGroup={entry.endOfGroup}
          time={formatTime(entry.message.createdAt)}
          seenAt={entry.message.id === seenId && conversation?.peerLastReadAt
            ? formatTime(conversation.peerLastReadAt)
            : null}
          onedit={(message) => (editing = message)}
          onreport={(message) => (reporting = message)} />
      </div>
    {/if}
  {/each}

  {#if typing}
    <p
      transition:fade={{ duration: reduced ? 0 : 150 }}
      class="text-dim mt-1.5 flex items-center gap-2 self-start text-xs">
      <span
        class="bg-surface-2 flex gap-1 rounded-full px-2.5 py-2"
        aria-hidden="true">
        {#each [0, 1, 2] as dot (dot)}
          <span
            class="bg-dim h-1.5 w-1.5 animate-pulse rounded-full motion-reduce:animate-none"
            style="animation-delay: {dot * 160}ms"></span>
        {/each}
      </span>
      {m.chat_typing({ name: peer?.displayName ?? "" })}
    </p>
  {/if}
</div>

{#if readOnlyNotice}
  <p
    class="border-border text-dim flex shrink-0 items-start gap-2.5 border-t px-4 py-3 text-xs">
    <Icon name="lock" class="mt-0.5 h-4 w-4 shrink-0" />
    {readOnlyNotice}
  </p>
{:else if conversation}
  <ChatComposer
    {conversationId}
    {peerName}
    {editing}
    oncanceledit={() => (editing = null)} />
{/if}

{#if reporting}
  {@const target = reporting}
  <ReportModal
    title={m.chat_report_title()}
    targetType="MESSAGE"
    subject={{
      title: peerName,
      detail: target.text ? chatPreview(target.text) : null,
    }}
    onClose={() => (reporting = null)}
    onSubmit={({ category, motif, reason }) =>
      reportMut.mutate([target.id, category, motif, reason])} />
{/if}
