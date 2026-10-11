<script lang="ts">
  import { drawPick, editMessage, sendMessage } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { upsertMessage, type MessagePages } from "#lib/chat/chat-cache.js";
  import {
    listShareable,
    ratingLabel,
    reviewedTitle,
  } from "#lib/chat/attachments.js";
  import { chatDrafts as drafts } from "#lib/chat/chat.svelte.js";
  import {
    pickChoices,
    pollReady,
    WHERE_KINDS,
    type PickChoice,
    type PollOptionDraft,
    type SagaChoice,
  } from "#lib/chat/commands.js";
  import {
    completeShortcode,
    emojiAtCaret,
    findEmoji,
    type Emoji,
  } from "#lib/chat/emoji.js";
  import {
    deserializeMentions,
    mentionAtCaret,
    serializeMentions,
    type Mention,
  } from "#lib/chat/composer-mentions.js";
  import {
    MAX_LINKED_WORKS,
    MAX_SCANNED_LINKS,
    previewLinkedWork,
    typedLinks,
  } from "#lib/chat/work-search.js";
  import {
    formatShortcut,
    readSlashCommand,
    toggleFormat,
    type ChatFormat,
  } from "#lib/chat/chat-markdown.js";
  import Icon from "#lib/components/Icon.svelte";
  import ListCoverGrid from "#lib/components/ListCoverGrid.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import {
    LIST_VISIBILITY_LABEL,
    workCountLabel,
  } from "#lib/constants/list-labels.js";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { auth } from "#lib/auth.svelte.js";
  import { isDomainEnabled, orderedDomains } from "#lib/domain-availability.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { socket } from "#lib/realtime/socket.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import {
    MESSAGE_TEXT_MAX_LENGTH,
    type MessageDto,
    type MessageWorkDto,
    type MyListDto,
    type MyReviewDto,
    type PickDomain,
    type ReviewTargetSummaryDto,
    type SendMessageRequestDto,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import FormatSelectionBar, {
    selectionBarAt,
    type SelectionBar,
  } from "./FormatSelectionBar.svelte";
  import ChatListPicker from "./ChatListPicker.svelte";
  import ChatPickChip from "./ChatPickChip.svelte";
  import ChatPicker from "./ChatPicker.svelte";
  import ChatPollBuilder from "./ChatPollBuilder.svelte";
  import ChatSagaPicker from "./ChatSagaPicker.svelte";
  import ChatEmojiPicker from "./ChatEmojiPicker.svelte";
  import ChatReviewPicker from "./ChatReviewPicker.svelte";
  import ChatWorkPicker from "./ChatWorkPicker.svelte";
  import MarkdownField from "./MarkdownField.svelte";
  import { workKindLabel } from "./conversation-presentation";

  let {
    conversationId,
    peerName,
    editing = null,
    oneditlast,
    oncanceledit,
  }: {
    conversationId: string;
    peerName: string;
    editing?: MessageDto | null;
    oncanceledit: () => void;
    /** ↑ in an empty field: edit the last message the viewer sent. */
    oneditlast?: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
  const queryClient = useQueryClient();
  const TYPING_EVERY_MS = 3000;
  const COUNTER_FROM = MESSAGE_TEXT_MAX_LENGTH - 200;

  let field = $state<MarkdownField | null>(null);
  let picker = $state<ChatWorkPicker | null>(null);
  let reviewPicker = $state<ChatReviewPicker | null>(null);
  let listPicker = $state<ChatListPicker | null>(null);
  let sagaPicker = $state<ChatSagaPicker | null>(null);
  let wherePicker = $state<ChatWorkPicker | null>(null);
  let pickPicker = $state<{
    handleKey: (event: KeyboardEvent) => boolean;
  } | null>(null);
  let mentionPicker = $state<ChatWorkPicker | null>(null);
  let emojiPicker = $state<ChatEmojiPicker | null>(null);
  let value = $state("");
  // Works mentioned with `#`: the field shows `#Title`, the message stores
  // a token (see serializeMentions).
  let mentions = $state<Mention[]>([]);
  let mentionAt = $state<{ start: number; query: string } | null>(null);
  let dismissedMentionAt = $state<number | null>(null);
  let emojiAt = $state<{ start: number; query: string } | null>(null);
  let dismissedEmojiAt = $state<number | null>(null);
  // What `/reco`, `/review` or `/list` attached: sent as a card with the message.
  type Attachment =
    | { kind: "work"; work: MessageWorkDto }
    | {
        kind: "review";
        review: MyReviewDto & { target: ReviewTargetSummaryDto };
      }
    | { kind: "list"; list: MyListDto }
    | { kind: "saga"; saga: SagaChoice }
    | { kind: "where"; work: MessageWorkDto }
    | {
        kind: "pick";
        domain: PickDomain;
        shared: boolean;
        /** Null while drawing, or with nothing to draw from. */
        work: MessageWorkDto | null;
        mine: number;
        sharedCount: number;
      };
  let attachment = $state<Attachment | null>(null);
  // `/poll`'s options while one is written; the question is the field's text.
  let pollOptions = $state<PollOptionDraft[] | null>(null);
  const attachedHref = $derived(
    attachment?.kind === "work" ? attachment.work.href : null,
  );
  // Links whose card the writer turned down: they go as plain links.
  let declinedLinks = $state<string[]>([]);
  let previewedLinks = $state<string[]>([]);
  let highlighted = $state<string | null>(null);
  let selectionBar = $state<SelectionBar | null>(null);
  let lastTypingAt = 0;

  interface Command {
    id: string;
    icon: IconName;
    label: string;
    hint: string;
    available: boolean;
    isNew?: boolean;
  }

  // Commands that attach something: a message being edited keeps its own.
  const ATTACHING = ["reco", "review", "list", "poll", "saga", "pick", "where"];

  const COMMANDS: Command[] = [
    {
      id: "spoiler",
      icon: "eye-off",
      label: "/spoiler",
      hint: m.chat_command_spoiler(),
      available: true,
    },
    {
      id: "reco",
      icon: "book-open",
      label: "/reco",
      hint: m.chat_command_reco(),
      available: true,
    },
    {
      id: "review",
      icon: "star",
      label: "/review",
      hint: m.chat_command_review(),
      available: true,
      isNew: isFeatureNew("chat-review-list"),
    },
    {
      id: "list",
      icon: "list",
      label: "/list",
      hint: m.chat_command_list(),
      available: true,
      isNew: isFeatureNew("chat-review-list"),
    },
    {
      id: "poll",
      icon: "stats",
      label: "/poll",
      hint: m.chat_command_poll(),
      available: true,
      isNew: isFeatureNew("chat-commands"),
    },
    {
      id: "saga",
      icon: "rows",
      label: "/saga",
      hint: m.chat_command_saga(),
      available: true,
      isNew: isFeatureNew("chat-commands"),
    },
    {
      id: "pick",
      icon: "sparkles",
      label: "/pick",
      hint: m.chat_command_pick(),
      available: true,
      isNew: isFeatureNew("chat-commands"),
    },
    {
      id: "where",
      icon: "monitor",
      label: "/where",
      hint: m.chat_command_where(),
      available: true,
      isNew: isFeatureNew("chat-commands"),
    },
  ];

  $effect(() => {
    const id = conversationId;
    // Drafts keep their mentions as tokens.
    const draft = deserializeMentions(drafts.get(id) ?? "");
    value = draft.text;
    mentions = draft.mentions;
    attachment = null;
    pollOptions = null;
    declinedLinks = [];
  });

  $effect(() => {
    if (!editing) return;
    const stored = deserializeMentions(editing.text ?? "");
    value = (editing.spoiler ? "/spoiler " : "") + stored.text;
    mentions = stored.mentions;
    void tick().then(() => {
      field?.focus();
      field?.select(value.length);
    });
  });

  const commands = $derived.by(() => {
    const typed = /^\/(\w*)$/.exec(value);
    return typed
      ? COMMANDS.filter(
          (c) =>
            c.id.startsWith(typed[1].toLowerCase()) &&
            !(editing && ATTACHING.includes(c.id)),
        )
      : [];
  });

  // What follows `/reco `, `/review `, `/list `, `/saga `, `/where ` or
  // `/pick `, while something to attach is being looked for.
  const picking = $derived.by(() => {
    const typed = editing
      ? null
      : /^\/(reco|review|list|saga|where|pick)\s([\s\S]*)$/.exec(value);
    return typed ? { command: typed[1], query: typed[2] } : null;
  });
  // `/pick` needs a domain: the viewer's, in their order.
  const pickOptions = $derived(
    picking?.command === "pick"
      ? pickChoices(
          orderedDomains(auth.user?.domainOrder),
          isDomainEnabled,
          picking.query,
        )
      : [],
  );
  const emojis = $derived(emojiAt ? findEmoji(emojiAt.query) : []);

  $effect(() => {
    if (!commands.some((c) => c.id === highlighted && c.available)) {
      highlighted = commands.find((c) => c.available)?.id ?? null;
    }
  });

  // What the links will turn into once sent, read once typing pauses: as the
  // API does, the first three cards among the links not turned down — so
  // turning one down brings in the next.
  const links = $derived(typedLinks(value));
  const candidates = $derived(
    links
      .filter((url) => !declinedLinks.includes(url))
      .slice(0, MAX_SCANNED_LINKS),
  );
  $effect(() => {
    const next = candidates;
    const timer = setTimeout(() => (previewedLinks = next), 500);
    return () => clearTimeout(timer);
  });
  const previewQuery = createApiQuery(() => ({
    key: keys.chat.linkPreviews(previewedLinks),
    // One cache entry per link: turning one down doesn't refetch the others.
    fetch: () =>
      Promise.all(
        previewedLinks.map(async (url) => ({
          url,
          work: await queryClient.ensureQueryData({
            queryKey: keys.chat.linkPreview(url),
            queryFn: () => previewLinkedWork(url).catch(() => null),
          }),
        })),
      ),
    enabled: previewedLinks.length > 0,
    keepPreviousData: true,
  }));
  const previews = $derived(
    (previewQuery.data ?? [])
      .filter(
        (preview, index, all) =>
          preview.work !== null &&
          candidates.includes(preview.url) &&
          preview.work.href !== attachedHref &&
          all.findIndex((other) => other.work?.href === preview.work?.href) ===
            index,
      )
      .slice(0, MAX_LINKED_WORKS)
      .map(({ url, work }) => ({ url, work: work as MessageWorkDto })),
  );

  const sendable = $derived(
    pollOptions
      ? pollReady(value, pollOptions)
      : picking === null &&
          (attachment?.kind === "pick"
            ? attachment.work !== null
            : readSlashCommand(value).text.length > 0 || attachment !== null),
  );

  const sendMut = createApiMutation(() => ({
    mutate: (body: SendMessageRequestDto) =>
      editing
        ? editMessage(editing.id, {
            text: body.text ?? "",
            spoiler: body.spoiler,
            skipLinks: body.skipLinks,
          })
        : sendMessage(conversationId, body),
    onSuccess: (message) => {
      queryClient.setQueryData<MessagePages>(
        keys.chat.messages(conversationId),
        (data) => upsertMessage(data, message),
      );
      if (editing) oncanceledit();
      attachment = null;
      pollOptions = null;
      declinedLinks = [];
      mentions = [];
      setValue("");
    },
    errorToast: true,
  }));

  function setValue(next: string) {
    value = next;
    saveDraft();
  }

  function saveDraft() {
    drafts.set(conversationId, serializeMentions(value, mentions));
  }

  function readMention() {
    const caret =
      field?.hasFocus() && picking === null && commands.length === 0
        ? field.selection().start
        : null;
    const found = caret === null ? null : mentionAtCaret(value, caret);
    mentionAt = found && found.start !== dismissedMentionAt ? found : null;
    if (!found) dismissedMentionAt = null;

    const emoji = caret === null ? null : emojiAtCaret(value, caret);
    emojiAt = emoji && emoji.start !== dismissedEmojiAt ? emoji : null;
    if (!emoji) dismissedEmojiAt = null;
  }

  function insertEmoji(emoji: Emoji) {
    if (!emojiAt || !field) return;
    const caret = field.selection().start;
    const inserted = `${emoji.emoji} `;
    const at = emojiAt.start;
    setValue(value.slice(0, at) + inserted + value.slice(caret));
    emojiAt = null;
    void tick().then(() => {
      field?.focus();
      field?.select(at + inserted.length);
    });
  }

  function insertMention(work: MessageWorkDto) {
    if (!mentionAt || !field) return;
    const caret = field.selection().start;
    const inserted = `#${work.title} `;
    if (!mentions.some((mention) => mention.title === work.title)) {
      mentions = [...mentions, { title: work.title, href: work.href }];
    }
    const at = mentionAt.start;
    setValue(value.slice(0, at) + inserted + value.slice(caret));
    mentionAt = null;
    // The caret lands right after `#Title `, which reads as a new search:
    // this one is done.
    dismissedMentionAt = at;
    void tick().then(() => {
      field?.focus();
      field?.select(at + inserted.length);
    });
  }

  function send() {
    if (!sendable || sendMut.loading) return;

    if (pollOptions) {
      sendMut.mutate({
        poll: {
          question: value.trim(),
          options: pollOptions
            .filter((option) => option.work || option.text.trim())
            .map((option) =>
              option.work
                ? { work: option.work.href }
                : { text: option.text.trim() },
            ),
        },
      });
      return;
    }

    const { text, spoiler } = readSlashCommand(
      serializeMentions(value, mentions),
    );
    sendMut.mutate({
      saga:
        attachment?.kind === "saga"
          ? { domain: attachment.saga.domain, key: attachment.saga.key }
          : undefined,
      where: attachment?.kind === "where" ? attachment.work.href : undefined,
      pick:
        attachment?.kind === "pick" && attachment.work
          ? {
              domain: attachment.domain,
              shared: attachment.shared,
              work: attachment.work.href,
            }
          : undefined,
      text: text || undefined,
      spoiler,
      work: attachedHref ?? undefined,
      review: attachment?.kind === "review" ? attachment.review.id : undefined,
      list: attachment?.kind === "list" ? attachment.list.id : undefined,
      skipLinks: declinedLinks.some((url) => links.includes(url))
        ? declinedLinks.filter((url) => links.includes(url))
        : undefined,
    });
  }

  function attach(next: Attachment) {
    attachment = next;
    setValue("");
    field?.focus();
  }

  const drawMut = createApiMutation(() => ({
    mutate: (args: { domain: PickDomain; shared: boolean }) =>
      drawPick(conversationId, args),
    onSuccess: (result, args) => {
      // A later draw (another scope, another go) wins over this one.
      if (attachment?.kind !== "pick" || attachment.domain !== args.domain) {
        return;
      }
      attachment = {
        ...attachment,
        shared: args.shared,
        work: result.work,
        mine: result.mine,
        sharedCount: result.shared,
      };
    },
    errorToast: true,
  }));

  function draw(domain: PickDomain, shared: boolean) {
    attachment = {
      kind: "pick",
      domain,
      shared,
      work: null,
      mine: attachment?.kind === "pick" ? attachment.mine : 0,
      sharedCount: attachment?.kind === "pick" ? attachment.sharedCount : 0,
    };
    drawMut.mutate({ domain, shared });
  }

  function startPick(choice: PickChoice) {
    setValue("");
    draw(choice.domain, false);
    field?.focus();
  }

  function pick(command: Command) {
    if (!command.available) return;

    if (command.id === "poll") {
      attachment = null;
      pollOptions = [
        { text: "", work: null },
        { text: "", work: null },
      ];
      setValue("");
      field?.focus();
      return;
    }

    setValue(`/${command.id} `);
    void tick().then(() => {
      field?.focus();
      field?.select(value.length);
    });
  }

  function format(kind: ChatFormat) {
    if (!field) return;
    const { start: selectionStart, end: selectionEnd } = field.selection();
    if (selectionStart === selectionEnd) return;
    mentionAt = null;

    const next = toggleFormat(value, selectionStart, selectionEnd, kind);
    setValue(next.value);
    void tick().then(() => {
      field?.focus();
      field?.select(next.start, next.end);
      placeSelectionBar();
    });
  }

  function placeSelectionBar() {
    readMention();
    selectionBar = selectionBarAt(field, value);
  }

  function announceTyping() {
    const now = Date.now();
    if (now - lastTypingAt < TYPING_EVERY_MS) return;
    lastTypingAt = now;
    socket.emit("chat-typing", { conversationId });
  }

  function oninput() {
    const completed =
      field && completeShortcode(value, field.selection().start);
    if (completed) {
      value = completed.value;
      void tick().then(() => field?.select(completed.caret));
    }
    saveDraft();
    placeSelectionBar();
    if (value.trim()) announceTyping();
  }

  function onkeydown(event: KeyboardEvent) {
    if (picking?.command === "reco" && picker?.handleKey(event)) return;
    if (picking?.command === "review" && reviewPicker?.handleKey(event)) {
      return;
    }
    if (picking?.command === "list" && listPicker?.handleKey(event)) return;
    if (picking?.command === "saga" && sagaPicker?.handleKey(event)) return;
    if (picking?.command === "where" && wherePicker?.handleKey(event)) return;
    if (picking?.command === "pick") {
      if (pickPicker?.handleKey(event)) return;
      // `/pick` alone is no message: a domain has to be picked.
      if (event.key === "Enter") {
        event.preventDefault();
        return;
      }
    }
    if (mentionAt && mentionPicker?.handleKey(event)) return;
    if (emojiAt && emojis.length > 0 && emojiPicker?.handleKey(event)) {
      return;
    }

    if (commands.length > 0) {
      const available = commands.filter((c) => c.available);
      const index = available.findIndex((c) => c.id === highlighted);

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : available.length - 1;
        highlighted = available[(index + step) % available.length]?.id ?? null;
        return;
      }

      if ((event.key === "Enter" || event.key === "Tab") && index !== -1) {
        event.preventDefault();
        pick(available[index]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setValue("");
        return;
      }
    }

    const mod = event.ctrlKey || event.metaKey;
    const shortcut = formatShortcut(event);

    if (shortcut) {
      event.preventDefault();
      format(shortcut);
    } else if (
      event.key === "ArrowUp" &&
      value === "" &&
      !editing &&
      !mod &&
      !event.altKey
    ) {
      event.preventDefault();
      oneditlast?.();
    } else if (event.key === "Backspace" && value === "" && attachment) {
      event.preventDefault();
      attachment = null;
    } else if (event.key === "Escape" && pollOptions) {
      event.preventDefault();
      pollOptions = null;
    } else if (event.key === "Escape" && editing) {
      event.preventDefault();
      setValue("");
      oncanceledit();
    } else if (event.key === "Enter" && !event.shiftKey && !layout.compact) {
      // On a phone, Enter is a new line: the send button is right there.
      event.preventDefault();
      send();
    }
  }
</script>

<div class="border-border relative shrink-0 border-t px-3 pt-2.5 pb-3">
  {#if editing}
    <div
      transition:fade={{ duration: reduced ? 0 : 150 }}
      class="text-accent mb-1.5 flex items-center gap-2 px-1 text-xs font-semibold">
      <Icon name="edit" class="h-3.5 w-3.5" />
      {m.chat_editing()}
      <button
        type="button"
        class="btn-icon ml-auto h-6 w-6"
        aria-label={m.common_cancel()}
        onclick={() => {
          setValue("");
          oncanceledit();
        }}>
        <Icon name="x" class="h-3.5 w-3.5" />
      </button>
    </div>
  {/if}

  {#snippet chip(
    images: (string | null)[],
    title: string,
    detail: string,
    removeLabel: string,
    onremove: () => void,
    linked: boolean,
  )}
    <div
      transition:scale={{ duration: reduced ? 0 : 150, start: 0.97 }}
      class="mb-2 flex items-center gap-2.5 rounded-xl border px-2 py-1.5 text-sm
        {linked ? 'border-border border-dashed' : 'border-accent bg-accent/10'}"
      style="transform-origin: bottom left;">
      <span class="w-[22px] shrink-0 overflow-hidden rounded-sm">
        {#if images.length > 1}
          <ListCoverGrid
            images={images.filter((src) => src !== null)}
            {title} />
        {:else}
          <Poster src={images[0] ?? null} {title} alt="" caption={false} />
        {/if}
      </span>
      <span class="min-w-0 flex-1 truncate">
        {#if linked}
          <span
            class="text-dim mr-1 font-mono text-[0.62rem] font-bold tracking-wider uppercase"
            >{m.chat_link_preview()}</span>
        {/if}
        <b class="font-semibold">{title}</b>
        <span class="text-dim">· {detail}</span>
      </span>
      <button
        type="button"
        class="btn-icon h-7 w-7"
        aria-label={removeLabel}
        onclick={onremove}>
        <Icon name="x" class="h-3.5 w-3.5" />
      </button>
    </div>
  {/snippet}

  {#if attachment?.kind === "work"}
    {@render chip(
      [attachment.work.imageUrl],
      attachment.work.title,
      workKindLabel(attachment.work.kind),
      m.chat_reco_remove(),
      () => (attachment = null),
      false,
    )}
  {:else if attachment?.kind === "review"}
    {@render chip(
      [attachment.review.target.imageUrl],
      reviewedTitle(attachment.review.target),
      `${m.chat_review_mine()} · ${ratingLabel(attachment.review.rating)}/10`,
      m.chat_review_remove(),
      () => (attachment = null),
      false,
    )}
  {:else if attachment?.kind === "list"}
    {@render chip(
      attachment.list.previewImageUrls,
      attachment.list.title,
      `${workCountLabel(attachment.list.itemCount)} · ${LIST_VISIBILITY_LABEL[attachment.list.visibility]}`,
      m.chat_list_remove(),
      () => (attachment = null),
      false,
    )}
  {:else if attachment?.kind === "saga"}
    {@render chip(
      [attachment.saga.imageUrl],
      attachment.saga.title,
      `${DOMAINS[attachment.saga.domain].label} · ${attachment.saga.seen}/${attachment.saga.released}`,
      m.chat_saga_remove(),
      () => (attachment = null),
      false,
    )}
  {:else if attachment?.kind === "where"}
    {@render chip(
      [attachment.work.imageUrl],
      attachment.work.title,
      m.chat_where_attached(),
      m.chat_reco_remove(),
      () => (attachment = null),
      false,
    )}
  {:else if attachment?.kind === "pick"}
    {@const drawn = attachment}
    <ChatPickChip
      domain={drawn.domain}
      shared={drawn.shared}
      work={drawn.work}
      mine={drawn.mine}
      sharedCount={drawn.sharedCount}
      drawing={drawMut.loading}
      onscope={(shared) => draw(drawn.domain, shared)}
      onreroll={() => draw(drawn.domain, drawn.shared)}
      onremove={() => (attachment = null)} />
  {/if}
  {#if pollOptions}
    <ChatPollBuilder
      bind:options={pollOptions}
      oncancel={() => {
        pollOptions = null;
        field?.focus();
      }} />
  {/if}
  {#each previews as preview (preview.url)}
    {@render chip(
      [preview.work.imageUrl],
      preview.work.title,
      workKindLabel(preview.work.kind),
      m.chat_link_preview_remove(),
      () => (declinedLinks = [...declinedLinks, preview.url]),
      true,
    )}
  {/each}

  <div class="flex items-end gap-2">
    <div class="relative min-w-0 flex-1">
      {#if picking?.command === "reco"}
        <ChatWorkPicker
          bind:this={picker}
          query={picking.query}
          onpick={(work) => attach({ kind: "work", work })}
          oncancel={() => setValue("")} />
      {:else if picking?.command === "review"}
        <ChatReviewPicker
          bind:this={reviewPicker}
          query={picking.query}
          onpick={(review) =>
            review.target &&
            attach({
              kind: "review",
              review: { ...review, target: review.target },
            })}
          oncancel={() => setValue("")} />
      {:else if picking?.command === "list"}
        <ChatListPicker
          bind:this={listPicker}
          query={picking.query}
          {peerName}
          onpick={(list) =>
            listShareable(list) && attach({ kind: "list", list })}
          oncancel={() => setValue("")} />
      {:else if picking?.command === "saga"}
        <ChatSagaPicker
          bind:this={sagaPicker}
          query={picking.query}
          onpick={(saga) => attach({ kind: "saga", saga })}
          oncancel={() => setValue("")} />
      {:else if picking?.command === "where"}
        <ChatWorkPicker
          bind:this={wherePicker}
          query={picking.query}
          kinds={WHERE_KINDS}
          onpick={(work) => attach({ kind: "where", work })}
          oncancel={() => setValue("")} />
      {:else if picking?.command === "pick"}
        <ChatPicker
          bind:this={pickPicker}
          items={pickOptions}
          key={(choice) => choice.name}
          label={m.chat_pick_choose()}
          title={m.chat_pick_choose()}
          empty={m.chat_pick_empty()}
          onpick={startPick}
          oncancel={() => setValue("")}>
          {#snippet row(choice)}
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
              style:background-color={`color-mix(in srgb, ${DOMAINS[choice.domain].accent} 18%, transparent)`}
              style:color={DOMAINS[choice.domain].accent}>
              <Icon name={DOMAINS[choice.domain].icon} class="h-4 w-4" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold"
                >{`/pick ${choice.name}`}</span>
              <span class="text-dim block text-xs">
                {choice.label} · {choice.pile}
              </span>
            </span>
          {/snippet}
        </ChatPicker>
      {/if}
      {#if emojiAt && emojis.length > 0}
        <ChatEmojiPicker
          bind:this={emojiPicker}
          {emojis}
          query={emojiAt.query}
          onpick={insertEmoji}
          oncancel={() => {
            dismissedEmojiAt = emojiAt?.start ?? null;
            emojiAt = null;
          }} />
      {/if}
      {#if mentionAt}
        <ChatWorkPicker
          bind:this={mentionPicker}
          query={mentionAt.query}
          holdsEnter={false}
          onpick={insertMention}
          oncancel={() => {
            dismissedMentionAt = mentionAt?.start ?? null;
            mentionAt = null;
          }} />
      {/if}
      {#if commands.length > 0}
        <div
          transition:scale={{ duration: reduced ? 0 : 150, start: 0.97 }}
          role="listbox"
          aria-label={m.chat_commands()}
          class="border-border bg-surface absolute inset-x-0 bottom-full z-30 mb-2 rounded-xl border p-1.5 shadow-xl"
          style="transform-origin: bottom left;">
          {#each commands as command (command.id)}
            <button
              type="button"
              role="option"
              aria-selected={highlighted === command.id}
              aria-disabled={!command.available}
              class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150
                {highlighted === command.id ? 'bg-surface-2' : ''}
                {command.available ? '' : 'cursor-default opacity-50'}"
              onmousedown={(e) => e.preventDefault()}
              onclick={() => pick(command)}>
              <span
                class="bg-surface-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg">
                <Icon name={command.icon} class="h-4 w-4" />
              </span>
              <span class="min-w-0">
                <span class="flex items-center gap-1.5 text-sm font-semibold"
                  >{command.label}{#if command.isNew}<NewBadge />{/if}</span>
                <span class="text-dim block text-xs">{command.hint}</span>
              </span>
            </button>
          {/each}
        </div>
      {/if}

      <MarkdownField
        bind:this={field}
        bind:value
        label={m.chat_message_label()}
        placeholder={pollOptions
          ? m.chat_poll_question()
          : m.chat_composer_placeholder({ name: peerName })}
        {mentions}
        maxLength={MESSAGE_TEXT_MAX_LENGTH}
        class="border-border focus-within:border-accent selection:bg-accent/30 bg-bg block w-full rounded-[1.2rem] border px-3.5 py-2 text-sm leading-relaxed transition-colors duration-150
          {layout.compact ? 'text-base' : ''}"
        {oninput}
        onselect={placeSelectionBar}
        {onkeydown}
        onblur={() => {
          selectionBar = null;
          mentionAt = null;
          emojiAt = null;
        }} />
    </div>
    <button
      type="button"
      class="bg-btn text-btn-fg grid h-10 w-10 shrink-0 place-items-center rounded-full transition-[opacity,transform] duration-150 enabled:hover:scale-105 disabled:opacity-35 motion-reduce:transition-none"
      aria-label={m.common_send()}
      disabled={!sendable || sendMut.loading}
      onclick={send}>
      <Icon name="send" class="h-4.5 w-4.5" />
    </button>
  </div>

  {#if value.length > COUNTER_FROM}
    <p class="text-warning mt-1 text-right font-mono text-[0.68rem]">
      {value.length} / {MESSAGE_TEXT_MAX_LENGTH}
    </p>
  {/if}
</div>

{#if selectionBar}
  <FormatSelectionBar bar={selectionBar} onformat={format} />
{/if}
