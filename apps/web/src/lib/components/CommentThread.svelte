<script lang="ts">
  import { longpress } from "#lib/actions/longpress.js";
  import {
    createComment,
    deleteComment,
    getCommentReplies,
    getComments,
    reactToComment,
    reportComment,
    unreactToComment,
    updateComment,
  } from "#lib/api/client.js";
  import { resolveApiError } from "#lib/api/errors.js";
  import { auth } from "#lib/auth.svelte.js";
  import Drawer from "#lib/components/Drawer.svelte";
  import Dropdown from "#lib/components/Dropdown.svelte";
  import RelativeTime from "#lib/components/RelativeTime.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { onRealtimeEvent } from "#lib/realtime/socket.js";
  import { toast } from "#lib/toast.svelte.js";
  import {
    COMMENT_EMOTE_DISPLAY,
    type CommentDto,
    type CommentEmote,
    type CommentTargetType,
    type PagedResult,
    type ReportCategory,
    type ReportMotif,
  } from "@loomkeep/shared";
  import {
    createInfiniteQuery,
    createMutation,
    useQueryClient,
    type InfiniteData,
  } from "@tanstack/svelte-query";
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import Avatar from "./Avatar.svelte";
  import { withUserTokens } from "#lib/chat/chat-markdown.js";
  import ChatMessageText from "./chat/ChatMessageText.svelte";
  import CommentComposer, { type CommentDraft } from "./CommentComposer.svelte";
  import CommentShareModal from "./chat/CommentShareModal.svelte";
  import CommentWorkCards from "./CommentWorkCards.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import Icon from "./Icon.svelte";
  import LevelBadge from "./LevelBadge.svelte";
  import ReportModal from "./ReportModal.svelte";

  let {
    targetType,
    targetId,
    canParticipate = false,
    focusCommentId = null,
    showSpoilers = false,
    seriesHref = null,
    unreadAfter = null,
    onmarkunread,
    share = null,
  }: {
    targetType: CommentTargetType;
    targetId: string;
    /** Reading is public; writing, replying and reacting require tracking. */
    canParticipate?: boolean;
    /** The comment addressed by a notification link, when already in the page. */
    focusCommentId?: string | null;
    showSpoilers?: boolean;
    /** A series' discussion: what an episode code means by default. */
    seriesHref?: string | null;
    /** Messages: up to when the viewer had read, for the "new" line. */
    unreadAfter?: string | null;
    /** Messages: unread again from this comment on. */
    onmarkunread?: (comment: CommentDto) => void;
    /** Messages: the work a comment shared with a friend links to. */
    share?: { title: string; href: string } | null;
  } = $props();

  const queryClient = useQueryClient();
  const reduced = prefersReducedMotion();
  const key = $derived(["comments", targetType, targetId] as const);
  const countKey = $derived(["comment-count", targetType, targetId] as const);

  const expanded = true;
  let feed = $state<HTMLDivElement | null>(null);

  const query = createInfiniteQuery<
    PagedResult<CommentDto>,
    Error,
    InfiniteData<PagedResult<CommentDto>>,
    typeof key,
    number
  >(() => ({
    queryKey: key,
    queryFn: ({ pageParam }) => getComments(targetType, targetId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
    enabled: expanded,
  }));

  // EventsGateway pushes comment and reaction changes while the thread is open.
  $effect(() => {
    const off = onRealtimeEvent<{
      targetType: string;
      targetId: string;
    }>("comment-changed", (event) => {
      if (event.targetType !== targetType || event.targetId !== targetId) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: countKey });
    });
    return () => {
      off();
    };
  });

  const comments = $derived(query.data?.pages.flatMap((p) => p.items) ?? []);

  $effect(() => {
    if (!focusCommentId || !query.data) return;
    const id = focusCommentId;
    void tick().then(() => {
      const target = document.getElementById(`comment-${id}`);
      // Older than the pages loaded (a search result): read back until it's
      // there. Each page re-runs this effect.
      if (!target) {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
        return;
      }
      // Lit for a moment, as a message found in a conversation.
      highlightedId = id;
      setTimeout(() => {
        if (highlightedId === id) highlightedId = null;
      }, 1600);
      target.scrollIntoView({
        block: "center",
      });
    });
  });
  // A deleted top-level comment only earns its tombstone when it still has
  // replies to keep attached; with none, there's nothing left to preserve so
  // it's simply dropped. A deleted reply never has children of its own, so
  // it's always dropped — no tombstone case applies to it. Read from
  // replyCount, not the embedded preview, which is only the thread's tail.
  const visibleComments = $derived(
    comments
      .filter((c) => !(c.deleted && c.replyCount === 0))
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );

  const displayedComments = $derived(visibleComments);
  let latestCommentId: string | null = null;
  let showJumpToLatest = $state(false);
  let shouldPinToLatest = false;
  // Read before a new comment renders: measured after, its own height
  // would count as distance from the bottom.
  let atBottom = true;
  let feedContent = $state<HTMLDivElement | null>(null);

  $effect(() => {
    const latest = visibleComments.at(-1)?.id;
    if (!feed || !latest || focusCommentId) return;

    if (shouldPinToLatest || latestCommentId === null || atBottom) {
      void tick().then(() => {
        if (feed) {
          feed.scrollTop = feed.scrollHeight;
          showJumpToLatest = false;
          shouldPinToLatest = false;
        }
      });
    }
    latestCommentId = latest;
  });

  // Replies beyond the preview each list page embeds: fetched on demand from
  // /comments/{id}/replies, newest page first, accumulated per comment.
  let loadedReplies = $state<Map<string, CommentDto[]>>(new Map());
  let nextReplyPage = $state<Map<string, number>>(new Map());
  let loadingReplies = $state<Set<string>>(new Set());

  /**
   * What to render under a comment: the embedded preview until "earlier
   * replies" is used, then the accumulated pages — with the latest preview
   * merged back in on every poll, so a reply posted meanwhile shows up
   * without collapsing the thread.
   */
  function repliesOf(c: CommentDto): CommentDto[] {
    const loaded = loadedReplies.get(c.id);
    if (!loaded) return c.replies;

    const byId = new Map([...loaded, ...c.replies].map((r) => [r.id, r]));
    return [...byId.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  async function expandReplies(id: string) {
    if (loadingReplies.has(id)) return;
    loadingReplies = new Set(loadingReplies).add(id);

    try {
      const page = nextReplyPage.get(id) ?? 1;
      const result = await getCommentReplies(id, page);
      const merged = [...(loadedReplies.get(id) ?? []), ...result.items];
      loadedReplies = new Map(loadedReplies).set(id, merged);
      nextReplyPage = new Map(nextReplyPage).set(id, page + 1);
    } catch (err) {
      toast.error(resolveApiError(err));
    } finally {
      const next = new Set(loadingReplies);
      next.delete(id);
      loadingReplies = next;
    }
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: countKey });
  }

  async function loadOlder(): Promise<void> {
    if (!query.hasNextPage || query.isFetchingNextPage) return;

    const scrollTop = feed?.scrollTop ?? 0;
    const scrollHeight = feed?.scrollHeight ?? 0;
    await query.fetchNextPage();
    await tick();

    if (feed) {
      feed.scrollTop = scrollTop + feed.scrollHeight - scrollHeight;
      updateJumpToLatest();
    }
  }

  function loadOlderWhenVisible(
    node: HTMLElement,
    root: HTMLDivElement | null,
  ) {
    let observer: IntersectionObserver | undefined;

    function observe(scrollRoot: HTMLDivElement | null) {
      observer?.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) void loadOlder();
        },
        { root: scrollRoot, rootMargin: "160px 0px 0px" },
      );
      observer.observe(node);
    }

    observe(root);
    return {
      update: observe,
      destroy: () => observer?.disconnect(),
    };
  }

  function updateJumpToLatest() {
    if (!feed) return;
    const distance = feed.scrollHeight - feed.scrollTop - feed.clientHeight;
    atBottom = distance < 80;
    showJumpToLatest = distance > 160;
  }

  // Images and reply previews can grow the feed after a comment arrived:
  // the bottom stays in view if it was.
  $effect(() => {
    if (!feed || !feedContent) return;
    const el = feed;
    const observer = new ResizeObserver(() => {
      if (atBottom && !focusCommentId) el.scrollTop = el.scrollHeight;
    });
    observer.observe(feedContent);
    return () => observer.disconnect();
  });

  function scrollToBottom() {
    if (!feed) return;
    feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
    showJumpToLatest = false;
  }

  const createMut = createMutation(() => ({
    mutationFn: createComment,
    onSuccess: invalidate,
  }));
  const updateMut = createMutation(() => ({
    mutationFn: (vars: {
      id: string;
      text: string;
      spoilerTag?: boolean;
      mentions?: { userId: string; start: number }[];
    }) =>
      updateComment(vars.id, {
        text: vars.text,
        spoilerTag: vars.spoilerTag,
        mentions: vars.mentions,
      }),
    onSuccess: invalidate,
  }));
  const deleteMut = createMutation(() => ({
    mutationFn: deleteComment,
    onSuccess: invalidate,
  }));
  const reactMut = createMutation(() => ({
    mutationFn: (vars: { id: string; emote: CommentEmote }) =>
      reactToComment(vars.id, vars.emote),
    onSuccess: invalidate,
  }));
  const unreactMut = createMutation(() => ({
    mutationFn: unreactToComment,
    onSuccess: invalidate,
  }));

  let replyToId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let revealed = $state<Set<string>>(new Set());
  let confirmDeleteId = $state<string | null>(null);
  let reportingId = $state<string | null>(null);
  const reportingSubject = $derived.by(() => {
    const comment = [...comments, ...comments.flatMap(repliesOf)].find(
      (c) => c.id === reportingId,
    );
    if (!comment) return undefined;
    return {
      title: comment.author?.displayName ?? m.comment_report_title(),
      detail: comment.text,
    };
  });

  // Long press (touch): its actions in a sheet, as for a message in
  // Messages, where the hover pills can't show.
  let focusedId = $state<string | null>(null);
  let highlightedId = $state<string | null>(null);
  let sharing = $state<CommentDto | null>(null);

  // The "new" line, as in a conversation: above the first comment — or the
  // comment whose replies — someone else wrote since the viewer last read.
  // Placed once, so reading the discussion doesn't take it away at once.
  let unreadFrom = $state<string | null>(null);
  let unreadPlaced = false;

  function unreadThreadOf(after: string): string | null {
    const newer = (c: CommentDto) =>
      c.author?.id !== auth.user?.id && c.createdAt > after;
    return (
      visibleComments.find((c) => newer(c) || repliesOf(c).some(newer))?.id ??
      null
    );
  }

  $effect(() => {
    if (unreadPlaced || !query.data) return;
    unreadPlaced = true;
    if (!unreadAfter) return;
    unreadFrom = unreadThreadOf(unreadAfter);
    if (!unreadFrom) return;
    // Opens on the line, once the feed went to its bottom and laid out.
    void tick().then(() =>
      requestAnimationFrame(() => {
        const line = feed?.querySelector("[data-unread-line]");
        if (!line) return;
        atBottom = false;
        line.scrollIntoView({ block: "center" });
      }),
    );
  });

  function markUnread(comment: CommentDto) {
    onmarkunread?.(comment);
    unreadFrom = unreadThreadOf(
      new Date(Date.parse(comment.createdAt) - 1).toISOString(),
    );
  }
  const focused = $derived.by(() => {
    if (!focusedId) return null;
    for (const c of visibleComments) {
      if (c.id === focusedId) return { comment: c, isReply: false };
      const reply = repliesOf(c).find((r) => r.id === focusedId);
      if (reply) return { comment: reply, isReply: true };
    }
    return null;
  });

  const allowSpoilerTag = $derived(targetType !== "MUSIC");

  // Anti-flood cooldown (mirrors the backend's 1-per-5s throttle on POST
  // /comments) — shared between the top-level composer and replies, since
  // it's the same rate-limited endpoint. Client-only, self-paced; lost on
  // reload is an accepted edge case.
  let cooldownUntil = $state(0);
  let cooldownRemaining = $state(0);

  function tickCooldown() {
    const remaining = Math.max(
      0,
      Math.ceil((cooldownUntil - Date.now()) / 1000),
    );
    cooldownRemaining = remaining;
    if (remaining > 0) setTimeout(tickCooldown, 250);
  }

  function startCooldown() {
    cooldownUntil = Date.now() + 5000;
    tickCooldown();
  }

  function reveal(id: string) {
    revealed = new Set(revealed).add(id);
  }

  function expand(node: Element) {
    const style = getComputedStyle(node);
    const height = parseFloat(style.height);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);
    const marginTop = parseFloat(style.marginTop);
    const borderTop = parseFloat(style.borderTopWidth);
    const borderBottom = parseFloat(style.borderBottomWidth);

    return {
      duration: reduced ? 0 : 180,
      css: (t: number) =>
        `overflow: hidden; height: ${t * height}px; margin-top: ${t * marginTop}px; padding-top: ${t * paddingTop}px; padding-bottom: ${t * paddingBottom}px; border-top-width: ${t * borderTop}px; border-bottom-width: ${t * borderBottom}px;`,
    };
  }

  async function submitTop(draft: CommentDraft): Promise<boolean> {
    try {
      await createMut.mutateAsync({
        targetType,
        targetId,
        text: draft.text,
        spoilerTag: draft.spoilerTag || undefined,
        mentions: draft.mentions,
      });
      startCooldown();
      shouldPinToLatest = true;
      void tick().then(scrollToBottom);
      return true;
    } catch (err) {
      toast.error(resolveApiError(err));
      return false;
    }
  }

  async function submitReply(
    parentId: string,
    draft: CommentDraft,
  ): Promise<boolean> {
    try {
      await createMut.mutateAsync({
        targetType,
        targetId,
        parentId,
        text: draft.text,
        spoilerTag: draft.spoilerTag || undefined,
        mentions: draft.mentions,
      });
      replyToId = null;
      startCooldown();
      shouldPinToLatest = true;
      void tick().then(scrollToBottom);
      return true;
    } catch (err) {
      toast.error(resolveApiError(err));
      return false;
    }
  }

  function startEdit(c: CommentDto) {
    replyToId = null;
    editingId = c.id;
  }

  // ↑ in an empty field, as in Messages: the viewer's latest comment.
  function editLastMine() {
    const mine = [...comments, ...comments.flatMap(repliesOf)]
      .filter((c) => c.author?.id === auth.user?.id && !c.deleted && c.text)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .at(-1);
    if (mine) startEdit(mine);
  }

  function cancelEdit() {
    editingId = null;
  }

  function startReply(id: string) {
    editingId = null;
    replyToId = replyToId === id ? null : id;
  }

  function cancelReply() {
    replyToId = null;
  }

  async function submitEdit(id: string, draft: CommentDraft): Promise<boolean> {
    try {
      await updateMut.mutateAsync({
        id,
        text: draft.text,
        spoilerTag: draft.spoilerTag,
        mentions: draft.mentions,
      });
      editingId = null;
      return true;
    } catch (err) {
      toast.error(resolveApiError(err));
      return false;
    }
  }

  async function confirmRemove() {
    if (!confirmDeleteId) return;
    try {
      await deleteMut.mutateAsync(confirmDeleteId);
      confirmDeleteId = null;
    } catch (err) {
      toast.error(resolveApiError(err));
    }
  }

  async function copyText(comment: CommentDto) {
    try {
      await navigator.clipboard.writeText(comment.text ?? "");
      toast.success(m.chat_text_copied());
    } catch {
      toast.error(m.chat_copy_failed());
    }
  }

  async function react(id: string, emote: CommentEmote) {
    try {
      await reactMut.mutateAsync({ id, emote });
    } catch (err) {
      toast.error(resolveApiError(err));
    }
  }

  async function unreact(id: string) {
    try {
      await unreactMut.mutateAsync(id);
    } catch (err) {
      toast.error(resolveApiError(err));
    }
  }

  function openReport(id: string) {
    reportingId = id;
  }

  async function submitReport(report: {
    category: ReportCategory;
    motif?: ReportMotif;
    reason?: string;
  }) {
    if (!reportingId) return;
    try {
      await reportComment(
        reportingId,
        report.category,
        report.motif,
        report.reason,
      );
      toast.success(m.comment_reported());
    } catch {
      toast.error(m.comment_report_failed());
    } finally {
      reportingId = null;
    }
  }
</script>

{#snippet emotePicker(c: CommentDto, onpicked: () => void)}
  <div class="flex gap-0.5" role="group" aria-label={m.common_react()}>
    {#each Object.entries(COMMENT_EMOTE_DISPLAY) as [emote, glyph] (emote)}
      <button
        type="button"
        class="hover:bg-surface-2 grid h-9 w-9 place-items-center rounded-full text-lg transition-[transform,background-color] duration-150 hover:scale-110 motion-reduce:transition-none
          {c.myReaction === emote ? 'bg-accent/20' : ''}"
        aria-pressed={c.myReaction === emote}
        onclick={() => {
          onpicked();
          if (c.myReaction === emote) void unreact(c.id);
          else void react(c.id, emote as CommentEmote);
        }}>
        {glyph}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet menuItems(c: CommentDto, isReply: boolean, close: () => void)}
  {@const mine = c.author?.id === auth.user?.id}
  {#if !isReply && canParticipate}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        startReply(c.id);
      }}>
      <Icon name="reply" class="h-4 w-4" />
      {m.common_reply()}
    </button>
  {/if}
  {#if mine}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        startEdit(c);
      }}>
      <Icon name="edit" class="h-4 w-4" />
      {m.common_edit()}
    </button>
  {/if}
  {#if c.text && (mine || !c.masked || showSpoilers || revealed.has(c.id))}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        void copyText(c);
      }}>
      <Icon name="copy" class="h-4 w-4" />
      {m.chat_copy_text()}
    </button>
  {/if}
  {#if !mine && onmarkunread}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        markUnread(c);
      }}>
      <Icon name="mark-unread" class="h-4 w-4" />
      {m.chat_mark_unread()}
    </button>
  {/if}
  {#if share && c.text}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        sharing = c;
      }}>
      <Icon name="forward" class="h-4 w-4" />
      {m.chat_share_comment_ellipsis()}
    </button>
  {/if}
  {#if mine}
    <button
      role="menuitem"
      class="menu-item menu-item-danger border-border border-t"
      onclick={() => {
        close();
        confirmDeleteId = c.id;
      }}>
      <Icon name="trash" class="h-4 w-4" />
      {m.chat_delete_ellipsis()}
    </button>
  {:else}
    <button
      role="menuitem"
      class="menu-item menu-item-danger border-border border-t"
      onclick={() => {
        close();
        openReport(c.id);
      }}>
      <Icon name="flag" class="h-4 w-4" />
      {m.common_report()}
    </button>
  {/if}
{/snippet}

{#snippet actionRow(c: CommentDto, isReply: boolean)}
  <div class="relative mt-1 flex flex-wrap items-center gap-1">
    {#each Object.entries(COMMENT_EMOTE_DISPLAY) as [emote, glyph] (emote)}
      {@const count = c.reactions.find((r) => r.emote === emote)?.count ?? 0}
      {#if count > 0 || c.myReaction === emote}
        <button
          class="rounded-full px-2 py-0.5 text-xs transition-[transform,background-color,color,box-shadow] hover:-translate-y-px hover:scale-[1.035] active:scale-95 {c.myReaction ===
          emote
            ? 'bg-accent/20 text-accent hover:bg-accent/30 hover:ring-accent/30 hover:ring-1'
            : 'bg-surface-2 text-dim hover:bg-surface hover:text-fg hover:shadow-sm'}"
          disabled={!canParticipate}
          onclick={() =>
            c.myReaction === emote
              ? unreact(c.id)
              : react(c.id, emote as CommentEmote)}>
          {glyph}
          {count > 0 ? count : ""}
        </button>
      {/if}
    {/each}

    <!-- The same two pills as a message in Messages; a long press opens
         their sheet on touch screens. -->
    <div
      class="pointer-events-none absolute -top-1 right-0 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 has-[[aria-expanded=true]]:pointer-events-auto has-[[aria-expanded=true]]:opacity-100">
      {#if canParticipate}
        <Dropdown
          placement="bottom-end"
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
            {@render emotePicker(c, close)}
          {/snippet}
        </Dropdown>
      {/if}
      <Dropdown placement="bottom-end" class="min-w-52">
        {#snippet trigger({ open, toggle, onkeydown })}
          <button
            type="button"
            class="border-border bg-surface text-dim hover:text-fg grid h-7 w-7 place-items-center rounded-full border transition-colors duration-150"
            aria-label={m.common_more_actions()}
            aria-haspopup="menu"
            aria-expanded={open}
            {onkeydown}
            onclick={toggle}>
            <Icon name="dots-horizontal" class="h-4 w-4" />
          </button>
        {/snippet}
        {#snippet children({ close })}
          {@render menuItems(c, isReply, close)}
        {/snippet}
      </Dropdown>
    </div>
  </div>
{/snippet}

{#snippet commentCard(c: CommentDto, isReply: boolean)}
  {@const mentioned = c.mentions.some(
    (mention) => mention.id === auth.user?.id,
  )}
  <div
    id="comment-{c.id}"
    class="group relative overflow-visible rounded-lg transition-colors duration-500 [-webkit-touch-callout:none]
      {isReply ? 'py-2.5 pl-1' : '-mx-2 px-2 py-3.5'}
      {focusedId === c.id ? 'bg-surface-2' : ''}
      {highlightedId === c.id ? 'bg-accent/10' : ''}"
    use:longpress={{ onLongPress: () => (focusedId = c.id), duration: 450 }}>
    {#if c.deleted}
      <p class="text-dim text-sm italic">
        {c.deletedByAdmin ? m.comment_deleted_by_admin() : m.comment_deleted()}
      </p>
    {:else}
      <div class="flex items-start gap-3">
        {#if !c.author}
          <span class="shrink-0">
            <Avatar seed="utilisateur-supprime" size={isReply ? 28 : 32} />
          </span>
        {:else if c.author.anonymized}
          <!-- Seeded on the derived pseudonym, never the real id — a stable
               seed would let the same identicon resurface across unrelated
               threads and quietly de-anonymize the author. -->
          <span class="shrink-0">
            <Avatar seed={c.author.displayName} size={isReply ? 28 : 32} />
          </span>
        {:else}
          <a href="/app/u/{c.author.username}" class="shrink-0">
            <Avatar
              seed={c.author.username}
              url={c.author.avatarUrl}
              size={isReply ? 28 : 32} />
          </a>
        {/if}
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            {#if mentioned}
              <span
                class="bg-accent inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                aria-hidden="true"></span>
            {/if}
            {#if !c.author}
              <span class="text-dim truncate text-sm font-semibold italic">
                {m.common_deleted_user()}
              </span>
            {:else if c.author.anonymized}
              <span class="timecode truncate text-sm font-semibold">
                {c.author.displayName}
              </span>
            {:else}
              <a href="/app/u/{c.author.username}" class="btn-text text-sm">
                {c.author.displayName}
              </a>
              {#if appConfig.gamificationEnabled}
                <LevelBadge xp={c.author.xp} />
              {/if}
            {/if}
            <RelativeTime iso={c.createdAt} class="timecode text-[0.68rem]" />
            {#if c.edited}
              <span class="text-dim text-xs">{m.comment_edited_marker()}</span>
            {/if}
          </div>

          {#if editingId === c.id}
            <div transition:expand class="mt-2">
              <CommentComposer
                id="comment-edit-{c.id}"
                {targetType}
                {targetId}
                label={m.common_edit()}
                submitLabel={m.common_save()}
                initial={{
                  text: c.text ?? "",
                  spoilerTag: c.spoilerTag,
                  mentions: c.mentions,
                }}
                {allowSpoilerTag}
                busy={updateMut.isPending}
                autofocus
                oncancel={cancelEdit}
                onsubmit={(draft) => submitEdit(c.id, draft)} />
            </div>
          {:else if c.masked && c.author?.id !== auth.user?.id && !showSpoilers && !revealed.has(c.id)}
            <!-- The same hatched wall as a spoiler message in Messages. -->
            <button
              type="button"
              class="text-fg mt-1.5 flex items-center gap-2 rounded-xl bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--accent)_22%,transparent)_0_8px,var(--surface-2)_8px_16px)] px-3.5 py-2.5 text-sm font-semibold transition-[filter] duration-150 hover:brightness-110"
              onclick={() => reveal(c.id)}>
              <Icon name="eye-off" class="h-4 w-4" />
              {m.comment_reveal_spoiler()}
            </button>
          {:else}
            <div class="mt-1 text-[0.95rem] leading-6">
              <ChatMessageText
                text={withUserTokens(c.text ?? "", c.mentions)}
                fallbackSeries={seriesHref} />
            </div>
            {#if appConfig.chatEnabled}
              <CommentWorkCards text={c.text ?? ""} />
            {/if}
          {/if}

          {#if editingId !== c.id && replyToId !== c.id}
            {@render actionRow(c, isReply)}
          {/if}

          {#if replyToId === c.id}
            <div transition:expand class="mt-2">
              <CommentComposer
                id="comment-reply-{c.id}"
                {targetType}
                {targetId}
                label={m.comment_reply_label()}
                placeholder={!c.author
                  ? m.comment_reply_placeholder()
                  : c.author.anonymized
                    ? m.comment_reply_to({ name: c.author.displayName })
                    : m.comment_reply_to({ name: `@${c.author.username}` })}
                submitLabel={m.common_reply()}
                {allowSpoilerTag}
                waitSeconds={cooldownRemaining}
                busy={createMut.isPending}
                autofocus
                oncancel={cancelReply}
                onsubmit={(draft) => submitReply(c.id, draft)} />
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/snippet}

<section class="relative flex min-h-0 flex-1 flex-col">
  <div class="relative min-h-0 flex-1">
    <div
      bind:this={feed}
      onscroll={updateJumpToLatest}
      class="h-full overflow-y-auto px-5 sm:px-6">
      <div bind:this={feedContent} class="py-4">
        {#if query.isPending}
          <p class="text-dim text-sm">{m.common_loading()}</p>
        {:else if query.isError}
          <div class="text-dim flex items-center justify-between gap-3 text-sm">
            <span>{m.comments_load_failed()}</span>
            <button
              class="btn btn-ghost btn-sm"
              onclick={() => query.refetch()}>
              {m.common_retry()}
            </button>
          </div>
        {:else if visibleComments.length === 0}
          <p class="text-dim text-sm">{m.comments_empty()}</p>
        {:else}
          {#if query.hasNextPage}
            <div use:loadOlderWhenVisible={feed} class="mb-2 text-center">
              <button
                class="timecode text-dim hover:text-fg text-xs"
                disabled={query.isFetchingNextPage}
                onclick={loadOlder}>
                {query.isFetchingNextPage
                  ? m.common_loading()
                  : m.common_load_more()}
              </button>
            </div>
          {/if}

          <div class="flex flex-col">
            {#each displayedComments as c (c.id)}
              {@const shownReplies = repliesOf(c)}
              {@const hiddenReplyCount = Math.max(
                0,
                c.replyCount - shownReplies.length,
              )}
              {#if c.id === unreadFrom}
                <div
                  role="separator"
                  data-unread-line
                  aria-label={m.chat_unread_from_here()}
                  class="text-accent my-1 flex items-center gap-2">
                  <span class="bg-accent h-px flex-1"></span>
                  <span
                    class="font-mono text-[0.62rem] font-bold tracking-widest uppercase"
                    >{m.common_new()}</span>
                  <span class="bg-accent h-px flex-1"></span>
                </div>
              {/if}
              {@render commentCard(c, false)}
              {#if shownReplies.length > 0}
                <div class="border-border/70 mt-1 ml-7 border-l pl-4">
                  {#each shownReplies as r (r.id)}
                    {#if !r.deleted}
                      {@render commentCard(r, true)}
                    {/if}
                  {/each}
                </div>
              {/if}
              {#if hiddenReplyCount > 0}
                <button
                  type="button"
                  class="timecode ml-5 block text-left text-xs hover:underline disabled:opacity-50"
                  disabled={loadingReplies.has(c.id)}
                  onclick={() => expandReplies(c.id)}>
                  {hiddenReplyCount === 1
                    ? m.comments_more_replies_one({ count: hiddenReplyCount })
                    : m.comments_more_replies_many({ count: hiddenReplyCount })}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if showJumpToLatest}
      <button
        type="button"
        transition:fly={{ y: 8, duration: 160 }}
        class="border-border bg-surface text-dim hover:text-fg hover:border-accent/60 absolute right-5 bottom-4 z-10 grid h-8 w-8 place-items-center rounded-full border shadow-lg transition-all hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:right-6"
        title={m.comments_jump_to_latest()}
        aria-label={m.comments_jump_to_latest()}
        onclick={scrollToBottom}>
        <Icon name="chevron-down" class="h-3.5 w-3.5" />
      </button>
    {/if}
  </div>

  <div class="border-border bg-bg shrink-0 border-t px-5 py-4 sm:px-6">
    {#if canParticipate}
      <CommentComposer
        id="comment-add-text"
        {targetType}
        {targetId}
        label={m.comment_add_label()}
        placeholder={m.comment_add_placeholder()}
        submitLabel={m.common_publish()}
        {allowSpoilerTag}
        waitSeconds={cooldownRemaining}
        busy={createMut.isPending}
        framed
        oneditlast={editLastMine}
        onsubmit={submitTop} />
    {:else}
      <p class="text-dim text-sm">
        {m.comments_track_to_participate()}
      </p>
    {/if}
  </div>
</section>

{#if confirmDeleteId}
  <ConfirmationModal
    title={m.comment_delete_title()}
    message={m.comment_delete_description()}
    confirmLabel={m.common_delete()}
    danger
    busy={deleteMut.isPending}
    onConfirm={confirmRemove}
    onCancel={() => (confirmDeleteId = null)} />
{/if}

{#if focused}
  <!-- Above the Messages sheet (z-50). -->
  <Drawer onclose={() => (focusedId = null)} zIndex={60}>
    <div class="flex flex-col gap-2 px-3 pt-1 pb-3">
      {#if canParticipate}
        <div class="self-center">
          {@render emotePicker(focused.comment, () => (focusedId = null))}
        </div>
      {/if}
      <div class="flex flex-col" role="menu">
        {@render menuItems(
          focused.comment,
          focused.isReply,
          () => (focusedId = null),
        )}
      </div>
    </div>
  </Drawer>
{/if}

{#if sharing && share}
  <CommentShareModal
    comment={sharing}
    {targetType}
    {targetId}
    title={share.title}
    href={share.href}
    onclose={() => (sharing = null)} />
{/if}

{#if reportingId}
  <ReportModal
    title={m.comment_report_title()}
    targetType="COMMENT"
    subject={reportingSubject}
    onClose={() => (reportingId = null)}
    onSubmit={submitReport} />
{/if}
