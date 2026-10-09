<script lang="ts">
  import { editMessage, sendMessage } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { upsertMessage, type MessagePages } from "#lib/chat/chat-cache.js";
  import { chatDrafts as drafts } from "#lib/chat/chat.svelte.js";
  import { previewLinkedWork, typedLinks } from "#lib/chat/work-search.js";
  import {
    readSlashCommand,
    selectionFormats,
    toggleFormat,
    type ChatFormat,
  } from "#lib/chat/chat-markdown.js";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { socket } from "#lib/realtime/socket.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import {
    MESSAGE_TEXT_MAX_LENGTH,
    type MessageDto,
    type MessageWorkDto,
    type SendMessageRequestDto,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { caretPosition } from "./caret-position";
  import ChatWorkPicker from "./ChatWorkPicker.svelte";
  import { workKindLabel } from "./conversation-presentation";

  let {
    conversationId,
    peerName,
    editing = null,
    oncanceledit,
  }: {
    conversationId: string;
    peerName: string;
    editing?: MessageDto | null;
    oncanceledit: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
  const queryClient = useQueryClient();
  const TYPING_EVERY_MS = 3000;
  const COUNTER_FROM = MESSAGE_TEXT_MAX_LENGTH - 200;

  let textarea = $state<HTMLTextAreaElement | null>(null);
  let picker = $state<ChatWorkPicker | null>(null);
  let value = $state("");
  // The work `/reco` attached: sent as a card with the message.
  let attached = $state<MessageWorkDto | null>(null);
  // Links whose card the writer turned down: they go as plain links.
  let declinedLinks = $state<string[]>([]);
  let previewedLinks = $state<string[]>([]);
  let highlighted = $state<string | null>(null);
  let selectionBar = $state<{
    left: number;
    top: number;
    active: ChatFormat[];
  } | null>(null);
  let lastTypingAt = 0;

  interface Command {
    id: string;
    icon: IconName;
    label: string;
    hint: string;
    available: boolean;
  }

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
  ];

  $effect(() => {
    const id = conversationId;
    value = drafts.get(id) ?? "";
    attached = null;
    declinedLinks = [];
    void tick().then(autosize);
  });

  $effect(() => {
    if (!editing) return;
    value = (editing.spoiler ? "/spoiler " : "") + (editing.text ?? "");
    void tick().then(() => {
      autosize();
      textarea?.focus();
      textarea?.setSelectionRange(value.length, value.length);
    });
  });

  const commands = $derived.by(() => {
    const typed = /^\/(\w*)$/.exec(value);
    return typed
      ? COMMANDS.filter(
          (c) =>
            c.id.startsWith(typed[1].toLowerCase()) &&
            !(editing && c.id === "reco"),
        )
      : [];
  });

  // What follows `/reco `, while a work is being looked for.
  const recoQuery = $derived(
    editing ? null : (/^\/reco\s([\s\S]*)$/.exec(value)?.[1] ?? null),
  );

  $effect(() => {
    if (!commands.some((c) => c.id === highlighted && c.available)) {
      highlighted = commands.find((c) => c.available)?.id ?? null;
    }
  });

  // What the links will turn into once sent — the first three, as the API
  // does — read once typing pauses.
  const links = $derived(typedLinks(value));
  $effect(() => {
    const next = links;
    const timer = setTimeout(() => (previewedLinks = next), 500);
    return () => clearTimeout(timer);
  });
  const previewQuery = createApiQuery(() => ({
    key: keys.chat.linkPreviews(previewedLinks),
    fetch: () =>
      Promise.all(
        previewedLinks.map(async (url) => ({
          url,
          work: await previewLinkedWork(url).catch(() => null),
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
          links.includes(preview.url) &&
          !declinedLinks.includes(preview.url) &&
          preview.work.href !== attached?.href &&
          all.findIndex((other) => other.work?.href === preview.work?.href) ===
            index,
      )
      .map(({ url, work }) => ({ url, work: work as MessageWorkDto })),
  );

  const sendable = $derived(
    recoQuery === null &&
      (readSlashCommand(value).text.length > 0 || attached !== null),
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
      attached = null;
      declinedLinks = [];
      setValue("");
    },
    errorToast: true,
  }));

  function setValue(next: string) {
    value = next;
    drafts.set(conversationId, next);
    void tick().then(autosize);
  }

  function autosize() {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight + 2, 160)}px`;
  }

  function send() {
    if (!sendable || sendMut.loading) return;
    const { text, spoiler } = readSlashCommand(value);
    sendMut.mutate({
      text: text || undefined,
      spoiler,
      work: attached?.href,
      skipLinks: declinedLinks.length > 0 ? declinedLinks : undefined,
    });
  }

  function attach(work: MessageWorkDto) {
    attached = work;
    setValue("");
    textarea?.focus();
  }

  function pick(command: Command) {
    if (!command.available) return;
    setValue(`/${command.id} `);
    textarea?.focus();
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
      placeSelectionBar();
    });
  }

  function placeSelectionBar() {
    if (
      !textarea ||
      document.activeElement !== textarea ||
      textarea.selectionStart === textarea.selectionEnd
    ) {
      selectionBar = null;
      return;
    }

    const box = textarea.getBoundingClientRect();
    const start = caretPosition(textarea, textarea.selectionStart);
    const end = caretPosition(textarea, textarea.selectionEnd);
    const middle =
      start.top === end.top ? (start.left + end.left) / 2 : start.left + 60;
    selectionBar = {
      left: Math.max(8, Math.min(box.left + middle - 110, innerWidth - 228)),
      top: Math.max(8, box.top + start.top - 46),
      active: selectionFormats(
        value,
        textarea.selectionStart,
        textarea.selectionEnd,
      ),
    };
  }

  function announceTyping() {
    const now = Date.now();
    if (now - lastTypingAt < TYPING_EVERY_MS) return;
    lastTypingAt = now;
    socket.emit("chat-typing", { conversationId });
  }

  function oninput() {
    drafts.set(conversationId, value);
    autosize();
    placeSelectionBar();
    if (value.trim()) announceTyping();
  }

  function onkeydown(event: KeyboardEvent) {
    if (recoQuery !== null && picker?.handleKey(event)) return;

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
    const key = event.key.toLowerCase();

    if (mod && event.shiftKey && key === "s") {
      event.preventDefault();
      format("spoiler");
    } else if (mod && !event.shiftKey && key === "b") {
      event.preventDefault();
      format("bold");
    } else if (mod && !event.shiftKey && key === "i") {
      event.preventDefault();
      format("italic");
    } else if (mod && event.shiftKey && key === "x") {
      event.preventDefault();
      format("strike");
    } else if (mod && !event.shiftKey && key === "e") {
      event.preventDefault();
      format("code");
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

  const FORMATS: { kind: ChatFormat; glyph: string; label: string }[] = [
    { kind: "bold", glyph: "B", label: m.chat_format_bold() },
    { kind: "italic", glyph: "I", label: m.chat_format_italic() },
    { kind: "strike", glyph: "S", label: m.chat_format_strike() },
    { kind: "code", glyph: "</>", label: m.chat_format_code() },
  ];
</script>

<svelte:document onselectionchange={placeSelectionBar} />

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

  {#snippet workChip(
    work: MessageWorkDto,
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
        <Poster src={work.imageUrl} title={work.title} alt="" caption={false} />
      </span>
      <span class="min-w-0 flex-1 truncate">
        {#if linked}
          <span
            class="text-dim mr-1 font-mono text-[0.62rem] font-bold tracking-wider uppercase"
            >{m.chat_link_preview()}</span>
        {/if}
        <b class="font-semibold">{work.title}</b>
        <span class="text-dim">· {workKindLabel(work.kind)}</span>
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

  {#if attached}
    {@render workChip(
      attached,
      m.chat_reco_remove(),
      () => (attached = null),
      false,
    )}
  {/if}
  {#each previews as preview (preview.url)}
    {@render workChip(
      preview.work,
      m.chat_link_preview_remove(),
      () => (declinedLinks = [...declinedLinks, preview.url]),
      true,
    )}
  {/each}

  <div class="flex items-end gap-2">
    <div class="relative min-w-0 flex-1">
      {#if recoQuery !== null}
        <ChatWorkPicker
          bind:this={picker}
          query={recoQuery}
          onpick={attach}
          oncancel={() => setValue("")} />
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
                <span class="block text-sm font-semibold">{command.label}</span>
                <span class="text-dim block text-xs">{command.hint}</span>
              </span>
            </button>
          {/each}
        </div>
      {/if}

      <label for="chat-composer-{conversationId}" class="sr-only">
        {m.chat_message_label()}
      </label>
      <textarea
        id="chat-composer-{conversationId}"
        bind:this={textarea}
        bind:value
        rows="1"
        maxlength={MESSAGE_TEXT_MAX_LENGTH}
        placeholder={m.chat_composer_placeholder({ name: peerName })}
        class="border-border bg-bg focus:border-accent selection:bg-accent/30 block w-full resize-none rounded-[1.2rem] border px-3.5 py-2 text-sm leading-relaxed transition-colors duration-150 outline-none
          {layout.compact ? 'text-base' : ''}"
        {oninput}
        {onkeydown}
        onblur={() => (selectionBar = null)}></textarea>
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
  <div
    transition:scale={{ duration: reduced ? 0 : 120, start: 0.95 }}
    role="toolbar"
    aria-label={m.chat_formatting()}
    class="bg-fg text-bg fixed z-[70] flex items-center gap-0.5 rounded-xl p-1 shadow-lg"
    style="left: {selectionBar.left}px; top: {selectionBar.top}px;">
    {#each FORMATS as item (item.kind)}
      {@const pressed = selectionBar.active.includes(item.kind)}
      <button
        type="button"
        class="grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm font-bold transition-colors duration-150
          {pressed ? 'bg-bg/25 text-accent' : 'hover:bg-bg/15'}"
        aria-label={item.label}
        aria-pressed={pressed}
        title={item.label}
        onmousedown={(e) => e.preventDefault()}
        onclick={() => format(item.kind)}>
        <span
          class={item.kind === "italic"
            ? "italic"
            : item.kind === "strike"
              ? "line-through"
              : item.kind === "code"
                ? "font-mono text-xs"
                : ""}>{item.glyph}</span>
      </button>
    {/each}
    <span class="bg-bg/25 mx-0.5 h-5 w-px"></span>
    <button
      type="button"
      class="bg-accent text-accent-fg grid h-8 w-8 place-items-center rounded-lg transition-[filter,box-shadow] duration-150 hover:brightness-110
        {selectionBar.active.includes('spoiler')
        ? 'ring-bg ring-2 ring-inset'
        : ''}"
      aria-label={m.chat_format_spoiler()}
      aria-pressed={selectionBar.active.includes("spoiler")}
      title={m.chat_format_spoiler()}
      onmousedown={(e) => e.preventDefault()}
      onclick={() => format("spoiler")}>
      <Icon name="eye-off" class="h-4 w-4" />
    </button>
  </div>
{/if}
