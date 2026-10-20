<script lang="ts">
  import type { PollOptionDraft } from "#lib/chat/commands.js";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    POLL_OPTION_MAX_LENGTH,
    POLL_OPTIONS_MAX,
    type MessageWorkDto,
  } from "@loomkeep/shared";
  import { tick } from "svelte";
  import { scale } from "svelte/transition";
  import ChatWorkPicker from "./ChatWorkPicker.svelte";

  let {
    options = $bindable(),
    oncancel,
  }: {
    /** The options being written; the question is the composer's text. */
    options: PollOptionDraft[];
    oncancel: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
  let root = $state<HTMLDivElement | null>(null);
  let picker = $state<ChatWorkPicker | null>(null);
  // The option whose `#` search is open.
  let searching = $state<number | null>(null);
  const query = $derived(
    searching === null
      ? null
      : (/^#(.+)$/.exec(options[searching]?.text.trim() ?? "")?.[1] ?? null),
  );

  function write(index: number, text: string) {
    options[index] = { text, work: null };
    searching = text.trim().startsWith("#") ? index : null;
  }

  async function choose(index: number, work: MessageWorkDto) {
    options[index] = { text: work.title, work };
    searching = null;
    await tick();
    root?.querySelector<HTMLInputElement>("input[data-empty]")?.focus();
  }

  async function add() {
    options.push({ text: "", work: null });
    await tick();
    root
      ?.querySelector<HTMLInputElement>(`[data-option="${options.length - 1}"]`)
      ?.focus();
  }
</script>

<div
  bind:this={root}
  transition:scale={{ duration: reduced ? 0 : 150, start: 0.97 }}
  class="border-accent bg-accent/5 mb-2 flex flex-col gap-1.5 rounded-xl border p-2.5"
  style="transform-origin: bottom left;">
  <div class="flex items-center justify-between gap-2">
    <span
      class="text-accent font-mono text-[0.68rem] font-bold tracking-wider uppercase">
      {m.chat_poll_builder()}
    </span>
    <button
      type="button"
      class="btn-icon h-7 w-7"
      aria-label={m.chat_poll_cancel()}
      onclick={oncancel}>
      <Icon name="x" class="h-3.5 w-3.5" />
    </button>
  </div>
  {#each options as option, i (i)}
    <div class="flex items-center gap-2">
      <span class="text-dim w-3.5 shrink-0 text-right font-mono text-[0.7rem]">
        {i + 1}
      </span>
      <div class="relative min-w-0 flex-1">
        {#if searching === i && query}
          <ChatWorkPicker
            bind:this={picker}
            {query}
            holdsEnter={false}
            onpick={(work) => choose(i, work)}
            oncancel={() => (searching = null)} />
        {/if}
        {#if option.work}
          <div
            class="border-accent bg-surface flex items-center gap-2 rounded-lg border py-1 pr-1 pl-1.5 text-sm font-semibold">
            <span class="w-4.5 shrink-0 overflow-hidden rounded-sm">
              <Poster
                src={option.work.imageUrl}
                title={option.work.title}
                alt=""
                caption={false} />
            </span>
            <span class="min-w-0 flex-1 truncate">{option.work.title}</span>
            <button
              type="button"
              class="btn-icon h-6 w-6"
              aria-label={m.chat_poll_remove_work()}
              onclick={() => (options[i] = { text: "", work: null })}>
              <Icon name="x" class="h-3 w-3" />
            </button>
          </div>
        {:else}
          <input
            data-option={i}
            data-empty={option.text.trim() ? undefined : ""}
            class="border-border bg-surface focus:border-accent w-full rounded-lg border px-2.5 py-1.5 text-sm transition-colors duration-150 outline-none"
            value={option.text}
            maxlength={POLL_OPTION_MAX_LENGTH}
            placeholder={m.chat_poll_option({ number: i + 1 })}
            aria-label={m.chat_poll_option_label({ number: i + 1 })}
            oninput={(event) => write(i, event.currentTarget.value)}
            onkeydown={(event) => {
              if (searching === i && query) picker?.handleKey(event);
            }}
            onblur={() => {
              if (searching === i) setTimeout(() => (searching = null), 150);
            }} />
        {/if}
      </div>
    </div>
  {/each}
  {#if options.length < POLL_OPTIONS_MAX}
    <button
      type="button"
      class="border-border hover:border-accent hover:text-accent self-start rounded-full border px-2.5 py-1 text-xs font-bold transition-colors duration-150"
      onclick={add}>
      {m.chat_poll_add()}
    </button>
  {:else}
    <span class="text-dim text-xs">
      {m.chat_poll_max({ max: POLL_OPTIONS_MAX })}
    </span>
  {/if}
</div>
