<script lang="ts">
  /* eslint-disable svelte/no-dom-manipulating -- contenteditable needs atomically editable mention tokens. */
  import { getCommentParticipants } from "$lib/api/client";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    CommentMentionDto,
    CommentTargetType,
    UserSummaryDto,
  } from "@loomkeep/shared";
  import Avatar from "./Avatar.svelte";

  let {
    value = $bindable(""),
    mentions = $bindable<CommentMentionDto[]>([]),
    targetType,
    targetId,
    id,
    name,
    label,
    placeholder = "",
    inputClass = "",
    multiline = false,
    rows = 1,
    onkeydown,
  }: {
    value?: string;
    mentions?: CommentMentionDto[];
    targetType: CommentTargetType;
    targetId: string;
    id: string;
    name: string;
    label: string;
    placeholder?: string;
    inputClass?: string;
    multiline?: boolean;
    rows?: number;
    onkeydown?: (event: KeyboardEvent) => void;
  } = $props();

  let editor = $state<HTMLDivElement | null>(null);
  let candidates = $state<UserSummaryDto[]>([]);
  let activeIndex = $state(0);
  let mentionStart = $state<number | null>(null);
  let loading = $state(false);
  let requestId = 0;
  let syncedValue = "";
  let syncedMentions = "";

  const open = $derived(mentionStart !== null);
  const activeOptionId = $derived(
    open && candidates[activeIndex]
      ? `${id}-mention-option-${activeIndex}`
      : undefined,
  );

  $effect(() => {
    if (!editor) return;
    const mentionKey = mentions
      .map((mention) => `${mention.id}:${mention.start}`)
      .join(",");
    if (value === syncedValue && mentionKey === syncedMentions) return;
    renderEditor();
  });

  function mentionAtCursor(text: string, cursor: number) {
    const match = /(^|[^\w.@])@([a-zA-Z0-9_]*)$/.exec(text.slice(0, cursor));
    if (!match) return null;
    return {
      start: cursor - match[2].length - 1,
      query: match[2],
    };
  }

  function mentionEnd(text: string, cursor: number) {
    const boundary = text.slice(cursor).search(/[^a-zA-Z0-9_]/);
    return boundary === -1 ? text.length : cursor + boundary;
  }

  function renderEditor(caretOffset?: number) {
    if (!editor) return;

    editor.replaceChildren();
    let textCursor = 0;
    const selected = mentions.toSorted((a, b) => a.start - b.start);

    for (const mention of selected) {
      const { start } = mention;
      if (start < textCursor) continue;
      if (
        value.slice(start, start + mention.username.length + 1) !==
        `@${mention.username}`
      ) {
        continue;
      }
      editor.append(document.createTextNode(value.slice(textCursor, start)));
      const token = document.createElement("span");
      token.dataset.mentionId = mention.id;
      token.dataset.mentionUsername = mention.username;
      token.dataset.mentionStart = String(mention.start);
      token.contentEditable = "false";
      token.className = "comment-mention";
      token.textContent = `@${mention.username}`;
      editor.append(token);
      textCursor = start + mention.username.length + 1;
    }
    const tail = value.slice(textCursor);
    if (tail) editor.append(document.createTextNode(tail));

    syncedValue = value;
    syncedMentions = mentions
      .map((mention) => `${mention.id}:${mention.start}`)
      .join(",");
    if (caretOffset !== undefined) setCaret(caretOffset);
  }

  function editorText() {
    return editor?.innerText.replace(/\u00a0/g, " ") ?? "";
  }

  function caretOffset() {
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return value.length;
    const range = selection.getRangeAt(0);
    const before = range.cloneRange();
    before.selectNodeContents(editor);
    before.setEnd(range.endContainer, range.endOffset);
    return before.toString().length;
  }

  function setCaret(offset: number) {
    if (!editor) return;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node = walker.nextNode() as Text | null;

    while (node) {
      if (remaining <= node.data.length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
      remaining -= node.data.length;
      node = walker.nextNode() as Text | null;
    }

    const range = document.createRange();
    range.setStart(editor, 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  async function updateSuggestions(text: string, cursor: number) {
    const mention = mentionAtCursor(text, cursor);
    if (!mention) {
      mentionStart = null;
      candidates = [];
      return;
    }

    mentionStart = mention.start;
    activeIndex = 0;
    const currentRequest = ++requestId;
    loading = true;
    try {
      const result = await getCommentParticipants(
        targetType,
        targetId,
        mention.query,
      );
      if (currentRequest === requestId) candidates = result;
    } catch {
      if (currentRequest === requestId) candidates = [];
    } finally {
      if (currentRequest === requestId) loading = false;
    }
  }

  function syncFromEditor() {
    if (!editor) return;
    value = editorText();
    mentions = [...editor.querySelectorAll<HTMLElement>("[data-mention-id]")]
      .map((token) => {
        const id = token.dataset.mentionId;
        const previousStart = Number(token.dataset.mentionStart);
        const existing = mentions.find(
          (mention) => mention.id === id && mention.start === previousStart,
        );
        return existing ? { ...existing, start: offsetBefore(token) } : null;
      })
      .filter((mention): mention is CommentMentionDto => mention !== null);
    syncedValue = value;
    syncedMentions = mentions
      .map((mention) => `${mention.id}:${mention.start}`)
      .join(",");
    void updateSuggestions(value, caretOffset());
  }

  function choose(candidate: UserSummaryDto) {
    if (mentionStart === null) return;
    const cursor = caretOffset();
    const end = mentionEnd(value, cursor);
    const insertionEnd = mentionStart + candidate.username.length + 2;
    const insertedLength = candidate.username.length + 2;
    const delta = insertedLength - (end - mentionStart);
    value = `${value.slice(0, mentionStart)}@${candidate.username} ${value.slice(end)}`;
    mentions = [
      ...mentions.map((mention) =>
        mention.start >= end
          ? { ...mention, start: mention.start + delta }
          : mention,
      ),
      { id: candidate.id, username: candidate.username, start: mentionStart },
    ];
    mentionStart = null;
    candidates = [];
    requestAnimationFrame(() => {
      editor?.focus();
      renderEditor(insertionEnd);
    });
  }

  function mentionBeforeCaret() {
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!range.collapsed) return null;

    const container = range.startContainer;
    const offset = range.startOffset;
    if (container.nodeType === Node.TEXT_NODE) {
      const text = container as Text;
      if (offset === 0) return text.previousSibling as HTMLElement | null;
      return null;
    }

    return container.childNodes[offset - 1] as HTMLElement | null;
  }

  function mentionAfterCaret() {
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!range.collapsed) return null;

    const container = range.startContainer;
    const offset = range.startOffset;
    if (container.nodeType === Node.TEXT_NODE) {
      const text = container as Text;
      if (offset === text.data.length)
        return text.nextSibling as HTMLElement | null;
      return null;
    }

    return container.childNodes[offset] as HTMLElement | null;
  }

  function offsetBefore(token: HTMLElement) {
    if (!editor) return 0;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.setEndBefore(token);
    return range.toString().length;
  }

  function makeMentionEditable(
    token: HTMLElement,
    change: "backspace" | "delete" | null = null,
  ) {
    const id = token.dataset.mentionId;
    const username = token.dataset.mentionUsername;
    const previousStart = Number(token.dataset.mentionStart);
    if (!id || !username || Number.isNaN(previousStart)) return;

    const tokenStart = offsetBefore(token);
    let replacement = `@${username}`;
    if (change === "backspace") replacement = replacement.slice(0, -1);
    if (change === "delete") replacement = replacement.slice(1);
    value = `${value.slice(0, tokenStart)}${replacement}${value.slice(
      tokenStart + username.length + 1,
    )}`;
    const delta = replacement.length - username.length - 1;
    mentions = mentions
      .filter(
        (mention) => !(mention.id === id && mention.start === previousStart),
      )
      .map((mention) =>
        mention.start > tokenStart
          ? { ...mention, start: mention.start + delta }
          : mention,
      );
    mentionStart = null;
    candidates = [];
    const nextCaret =
      change === "delete" ? tokenStart : tokenStart + replacement.length;
    renderEditor(nextCaret);
    void updateSuggestions(value, nextCaret);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (open && candidates.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % candidates.length;
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = (activeIndex - 1 + candidates.length) % candidates.length;
        return;
      }
      if (
        (event.key === "Enter" || event.key === "Tab") &&
        candidates[activeIndex]
      ) {
        event.preventDefault();
        choose(candidates[activeIndex]);
        return;
      }
    }

    if (open && event.key === "Escape") {
      event.preventDefault();
      mentionStart = null;
      candidates = [];
      return;
    }

    if (event.key === "Backspace") {
      const token = mentionBeforeCaret();
      if (token?.dataset.mentionId) {
        event.preventDefault();
        makeMentionEditable(token, "backspace");
        return;
      }
    }

    if (event.key === "Delete") {
      const token = mentionAfterCaret();
      if (token?.dataset.mentionId) {
        event.preventDefault();
        makeMentionEditable(token, "delete");
        return;
      }
    }

    if (!multiline && event.key === "Enter") event.preventDefault();
    onkeydown?.(event);
  }

  function handleFocus() {
    void updateSuggestions(value, caretOffset());
  }

  function handleBlur() {
    setTimeout(() => {
      mentionStart = null;
      candidates = [];
    }, 120);
  }

  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    document.execCommand(
      "insertText",
      false,
      event.clipboardData?.getData("text/plain") ?? "",
    );
  }

  function handleMouseDown(event: MouseEvent) {
    const token = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-mention-id]",
    );
    if (!token) return;
    event.preventDefault();
    makeMentionEditable(token);
  }
</script>

<div class="relative">
  <label class="sr-only" for={id}>{label}</label>
  <div
    bind:this={editor}
    {id}
    data-name={name}
    data-rows={rows}
    data-placeholder={placeholder}
    class="comment-mention-editor {inputClass} focus:ring-0 focus:outline-none"
    class:single-line={!multiline}
    contenteditable="true"
    role="textbox"
    aria-label={label}
    aria-multiline={multiline}
    aria-required="true"
    aria-controls="{id}-mention-listbox"
    aria-expanded={open}
    aria-activedescendant={activeOptionId}
    tabindex="0"
    oninput={syncFromEditor}
    onfocus={handleFocus}
    onblur={handleBlur}
    onkeydown={handleKeydown}
    onmousedown={handleMouseDown}
    onpaste={handlePaste}>
  </div>

  {#if open}
    <div
      class="bg-surface border-border absolute bottom-[calc(100%+0.5rem)] left-0 z-20 w-full overflow-hidden rounded-lg border p-1 shadow-xl"
      id="{id}-mention-listbox"
      role="listbox"
      aria-live="polite"
      aria-label={m.comments_mention_suggestions()}>
      {#if loading}
        <p class="text-dim px-2 py-1.5 text-xs">…</p>
      {:else if candidates.length === 0}
        <p class="text-dim px-2 py-1.5 text-xs">{m.comments_mention_empty()}</p>
      {:else}
        {#each candidates as candidate, index (candidate.id)}
          <button
            type="button"
            id="{id}-mention-option-{index}"
            role="option"
            aria-selected={index === activeIndex}
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors {index ===
            activeIndex
              ? 'bg-surface-2'
              : 'hover:bg-surface-2'}"
            onmousedown={(event) => event.preventDefault()}
            onclick={() => choose(candidate)}>
            <Avatar
              seed={candidate.username}
              url={candidate.avatarUrl}
              size={24} />
            <span class="min-w-0">
              <span class="block truncate text-xs font-semibold"
                >{candidate.displayName}</span>
              <span class="text-dim block truncate text-[0.68rem]"
                >@{candidate.username}</span>
            </span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .comment-mention-editor {
    position: relative;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .comment-mention-editor.single-line {
    overflow: hidden;
    white-space: nowrap;
  }

  .comment-mention-editor:empty::before {
    content: attr(data-placeholder);
    position: absolute;
    inset: 0 auto auto 0;
    color: color-mix(in srgb, var(--fg) 68%, var(--dim));
    pointer-events: none;
  }

  :global(.comment-mention) {
    color: var(--accent);
    font-weight: 650;
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--accent) 45%, transparent);
    text-decoration-thickness: 1px;
    text-underline-offset: 0.18em;
  }
</style>
