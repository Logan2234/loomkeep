<script lang="ts" module>
  import type { CommentMentionInputDto } from "@loomkeep/shared";

  export interface CommentDraft {
    text: string;
    spoilerTag: boolean;
    mentions: CommentMentionInputDto[];
  }
</script>

<script lang="ts">
  // A work's comment being written, replied or edited — the way Messages'
  // composer writes: Enter sends, Shift+Enter breaks the line, markdown and
  // its shortcuts, `#` works, `/spoiler`. Plus `@` for the people of the
  // discussion, as comments always had.
  import { getCommentParticipants } from "#lib/api/client.js";
  import {
    formatShortcut,
    placeUserMentions,
    readSlashCommand,
    toggleFormat,
    type ChatFormat,
  } from "#lib/chat/chat-markdown.js";
  import {
    deserializeMentions,
    highlightRuns,
    mentionAtCaret,
    serializeMentions,
    type Mention,
  } from "#lib/chat/composer-mentions.js";
  import { appConfig } from "#lib/config.svelte.js";
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    COMMENT_TEXT_MAX_LENGTH,
    type CommentMentionDto,
    type CommentTargetType,
    type MessageWorkDto,
    type UserSummaryDto,
  } from "@loomkeep/shared";
  import { tick } from "svelte";
  import { scale } from "svelte/transition";
  import Avatar from "./Avatar.svelte";
  import ChatWorkPicker from "./chat/ChatWorkPicker.svelte";
  import FormatSelectionBar, {
    selectionBarAt,
    type SelectionBar,
  } from "./chat/FormatSelectionBar.svelte";
  import Icon from "./Icon.svelte";

  let {
    id,
    targetType,
    targetId,
    label,
    placeholder = "",
    submitLabel,
    initial = null,
    allowSpoilerTag = true,
    waitSeconds = 0,
    busy = false,
    framed = false,
    autofocus = false,
    onsubmit,
    oncancel,
    oneditlast,
  }: {
    id: string;
    targetType: CommentTargetType;
    targetId: string;
    label: string;
    placeholder?: string;
    submitLabel: string;
    /** An edited comment, as stored. */
    initial?: {
      text: string;
      spoilerTag: boolean;
      mentions: CommentMentionDto[];
    } | null;
    allowSpoilerTag?: boolean;
    /** The posting cooldown still running, in seconds. */
    waitSeconds?: number;
    busy?: boolean;
    /** The discussion's own composer, at its foot. */
    framed?: boolean;
    autofocus?: boolean;
    /** Resolves true once posted: the field then empties. */
    onsubmit: (draft: CommentDraft) => Promise<boolean>;
    oncancel?: () => void;
    /** ↑ in an empty field: edit the viewer's last comment. */
    oneditlast?: () => void;
  } = $props();

  const reduced = prefersReducedMotion();

  let textarea = $state<HTMLTextAreaElement | null>(null);
  let backdrop = $state<HTMLDivElement | null>(null);
  let workPicker = $state<ChatWorkPicker | null>(null);
  let value = $state("");
  let spoilerTag = $state(false);
  // Works mentioned with `#` show as `#Title` and go as tokens; people
  // picked with `@` go with where their `@username` ends up.
  let works = $state<Mention[]>([]);
  let people = $state<{ id: string; username: string }[]>([]);
  let workAt = $state<{ start: number; query: string } | null>(null);
  let dismissedWorkAt = $state<number | null>(null);
  let personAt = $state<{ start: number; query: string } | null>(null);
  let candidates = $state<UserSummaryDto[]>([]);
  let activeCandidate = $state(0);
  let selectionBar = $state<SelectionBar | null>(null);
  let participantsRequest = 0;

  $effect(() => {
    if (!initial) return;
    const stored = deserializeMentions(initial.text);
    value = stored.text;
    works = stored.mentions;
    people = initial.mentions.map(({ id, username }) => ({ id, username }));
    spoilerTag = initial.spoilerTag;
  });

  $effect(() => {
    if (!autofocus || !textarea) return;
    void tick().then(() => {
      autosize();
      textarea?.focus();
      textarea?.setSelectionRange(value.length, value.length);
    });
  });

  // `/spoiler` is the one command a comment knows.
  const offersCommand = $derived(/^\/s?p?o?i?l?e?r?$/i.test(value));
  const serialized = $derived(serializeMentions(value, works));
  const sendable = $derived(
    readSlashCommand(serialized).text.length > 0 &&
      serialized.length <= COMMENT_TEXT_MAX_LENGTH,
  );
  const runs = $derived(highlightRuns(value, works));

  function autosize() {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight + 2, 160)}px`;
  }

  function setValue(next: string) {
    value = next;
    void tick().then(autosize);
  }

  function readMentions() {
    if (!textarea || document.activeElement !== textarea) {
      workAt = null;
      personAt = null;
      return;
    }
    const caret = textarea.selectionStart;

    const work = appConfig.chatEnabled ? mentionAtCaret(value, caret) : null;
    workAt = work && work.start !== dismissedWorkAt ? work : null;
    if (!work) dismissedWorkAt = null;

    const typed = /(^|[^\w.@])@([a-zA-Z0-9_]*)$/.exec(value.slice(0, caret));
    const person = typed
      ? { start: caret - typed[2].length - 1, query: typed[2] }
      : null;
    if (
      person?.query !== personAt?.query ||
      person?.start !== personAt?.start
    ) {
      personAt = person;
      activeCandidate = 0;
      void loadCandidates(person?.query ?? null);
    }
  }

  async function loadCandidates(query: string | null) {
    const request = ++participantsRequest;
    if (query === null) {
      candidates = [];
      return;
    }
    try {
      const found = await getCommentParticipants(targetType, targetId, query);
      if (request === participantsRequest) candidates = found;
    } catch {
      if (request === participantsRequest) candidates = [];
    }
  }

  function insert(at: number, inserted: string) {
    if (!textarea) return;
    const caret = textarea.selectionStart;
    setValue(value.slice(0, at) + inserted + value.slice(caret));
    void tick().then(() => {
      textarea?.focus();
      textarea?.setSelectionRange(at + inserted.length, at + inserted.length);
    });
  }

  function pickWork(work: MessageWorkDto) {
    if (!workAt) return;
    if (!works.some((mention) => mention.title === work.title)) {
      works = [...works, { title: work.title, href: work.href }];
    }
    const at = workAt.start;
    insert(at, `#${work.title} `);
    workAt = null;
    dismissedWorkAt = at;
  }

  function pickPerson(person: UserSummaryDto) {
    if (!personAt) return;
    people = [...people, { id: person.id, username: person.username }];
    insert(personAt.start, `@${person.username} `);
    personAt = null;
    candidates = [];
  }

  function format(kind: ChatFormat) {
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    if (selectionStart === selectionEnd) return;
    const next = toggleFormat(value, selectionStart, selectionEnd, kind);
    setValue(next.value);
    void tick().then(() => {
      textarea?.focus();
      textarea?.setSelectionRange(next.start, next.end);
      selectionBar = selectionBarAt(textarea, value);
    });
  }

  function onselectionchange() {
    readMentions();
    selectionBar = selectionBarAt(textarea, value);
  }

  async function submit() {
    if (!sendable || busy || waitSeconds > 0) return;
    const { text, spoiler } = readSlashCommand(serialized);
    const posted = await onsubmit({
      text,
      spoilerTag: allowSpoilerTag && (spoiler || spoilerTag),
      mentions: placeUserMentions(text, people),
    });
    if (!posted) return;
    setValue("");
    works = [];
    people = [];
    spoilerTag = false;
  }

  function onkeydown(event: KeyboardEvent) {
    if (workAt && workPicker?.handleKey(event)) return;

    if (personAt && candidates.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : candidates.length - 1;
        activeCandidate = (activeCandidate + step) % candidates.length;
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pickPerson(candidates[activeCandidate]);
        return;
      }
    }
    if (personAt && event.key === "Escape") {
      event.preventDefault();
      personAt = null;
      candidates = [];
      return;
    }

    if (offersCommand && value !== "") {
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        setValue("/spoiler ");
        return;
      }
    }

    const shortcut = formatShortcut(event);
    if (shortcut) {
      event.preventDefault();
      format(shortcut);
    } else if (
      event.key === "ArrowUp" &&
      value === "" &&
      !initial &&
      !event.altKey &&
      !(event.ctrlKey || event.metaKey)
    ) {
      if (oneditlast) {
        event.preventDefault();
        oneditlast();
      }
    } else if (event.key === "Escape" && oncancel) {
      event.preventDefault();
      oncancel();
    } else if (event.key === "Enter" && !event.shiftKey && !layout.compact) {
      // On a phone, Enter is a new line: the send button is right there.
      event.preventDefault();
      void submit();
    }
  }
</script>

<svelte:document {onselectionchange} />

<div
  class="flex flex-col gap-2 rounded-xl border transition-[border-color] duration-150
    {framed
    ? 'border-border bg-surface hover:border-fg/25 focus-within:border-fg/25 px-3 py-2.5'
    : 'border-border bg-surface-2 p-2.5'}">
  <div class="relative">
    {#if workAt}
      <ChatWorkPicker
        bind:this={workPicker}
        query={workAt.query}
        holdsEnter={false}
        onpick={pickWork}
        oncancel={() => {
          dismissedWorkAt = workAt?.start ?? null;
          workAt = null;
        }} />
    {:else if personAt && candidates.length > 0}
      <div
        transition:scale={{ duration: reduced ? 0 : 150, start: 0.97 }}
        role="listbox"
        id="{id}-people"
        aria-label={m.comments_mention_suggestions()}
        class="border-border bg-surface absolute inset-x-0 bottom-full z-30 mb-2 rounded-xl border p-1 shadow-xl"
        style="transform-origin: bottom left;">
        {#each candidates as candidate, index (candidate.id)}
          <button
            type="button"
            role="option"
            aria-selected={index === activeCandidate}
            class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150
              {index === activeCandidate
              ? 'bg-surface-2'
              : 'hover:bg-surface-2'}"
            onmousedown={(event) => event.preventDefault()}
            onclick={() => pickPerson(candidate)}>
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
      </div>
    {:else if offersCommand && value !== ""}
      <div
        transition:scale={{ duration: reduced ? 0 : 150, start: 0.97 }}
        role="listbox"
        aria-label={m.chat_commands()}
        class="border-border bg-surface absolute inset-x-0 bottom-full z-30 mb-2 rounded-xl border p-1.5 shadow-xl"
        style="transform-origin: bottom left;">
        <button
          type="button"
          role="option"
          aria-selected="true"
          class="bg-surface-2 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left"
          onmousedown={(e) => e.preventDefault()}
          onclick={() => {
            setValue("/spoiler ");
            textarea?.focus();
          }}>
          <span
            class="bg-surface grid h-8 w-8 shrink-0 place-items-center rounded-lg">
            <Icon name="eye-off" class="h-4 w-4" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold">/spoiler</span>
            <span class="text-dim block text-xs"
              >{m.chat_command_spoiler()}</span>
          </span>
        </button>
      </div>
    {/if}

    <label for={id} class="sr-only">{label}</label>
    <!-- Under the field, the same text in the same box, invisible but for
         the underline of its links and mentioned works. -->
    <div
      bind:this={backdrop}
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 overflow-hidden text-sm leading-relaxed break-words whitespace-pre-wrap text-transparent
        {layout.compact ? 'text-base' : ''}">
      {#each runs as run, i (i)}{#if run.marked}<span
            class="decoration-accent underline decoration-2 underline-offset-[3px]"
            >{run.text}</span
          >{:else}{run.text}{/if}{/each}&#8203;
    </div>
    <textarea
      {id}
      bind:this={textarea}
      bind:value
      rows={framed ? 2 : 1}
      {placeholder}
      class="placeholder:text-dim selection:bg-accent/30 relative block w-full resize-none [scrollbar-width:none] bg-transparent text-sm leading-relaxed outline-none
        {layout.compact ? 'text-base' : ''}"
      oninput={() => {
        autosize();
        onselectionchange();
      }}
      {onkeydown}
      onscroll={() => {
        if (backdrop && textarea) backdrop.scrollTop = textarea.scrollTop;
      }}
      onblur={() => {
        selectionBar = null;
        workAt = null;
        setTimeout(() => {
          personAt = null;
          candidates = [];
        }, 120);
      }}></textarea>
  </div>

  <div
    class="flex items-center gap-2 {framed
      ? 'border-border border-t pt-2'
      : ''}">
    {#if allowSpoilerTag}
      <button
        type="button"
        aria-pressed={spoilerTag}
        onclick={() => (spoilerTag = !spoilerTag)}
        class="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold transition-colors duration-150
          {spoilerTag
          ? 'text-accent bg-accent/10'
          : 'text-dim hover:text-fg hover:bg-surface-2'}">
        <Icon name="eye-off" class="h-3.5 w-3.5" />
        {spoilerTag ? m.comment_unmark_spoiler() : m.comment_mark_spoiler()}
      </button>
    {/if}
    <span
      class="timecode ml-auto text-[0.65rem] tabular-nums {serialized.length >
      COMMENT_TEXT_MAX_LENGTH
        ? 'text-danger'
        : 'text-dim'}">
      {serialized.length}/{COMMENT_TEXT_MAX_LENGTH}
    </span>
    {#if oncancel}
      <button type="button" class="btn btn-ghost btn-sm" onclick={oncancel}>
        {m.common_cancel()}
      </button>
    {/if}
    <button
      type="button"
      class="btn btn-primary btn-sm h-8 px-3"
      disabled={!sendable || busy || waitSeconds > 0}
      onclick={() => void submit()}>
      {waitSeconds > 0
        ? m.common_wait_seconds({ seconds: waitSeconds })
        : submitLabel}
    </button>
  </div>
</div>

{#if selectionBar}
  <FormatSelectionBar bar={selectionBar} onformat={format} />
{/if}
