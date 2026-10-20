<script lang="ts">
  import type { Emoji } from "#lib/chat/emoji.js";
  import { m } from "#lib/paraglide/messages.js";
  import ChatPicker from "./ChatPicker.svelte";

  let {
    emojis,
    query,
    onpick,
    oncancel,
  }: {
    emojis: Emoji[];
    /** What follows the `:`, set in amber inside each code. */
    query: string;
    onpick: (emoji: Emoji) => void;
    oncancel: () => void;
  } = $props();

  let picker = $state<{ handleKey: (event: KeyboardEvent) => boolean } | null>(
    null,
  );
  const typed = $derived(query.toLowerCase());

  export function handleKey(event: KeyboardEvent): boolean {
    return picker?.handleKey(event) ?? false;
  }
</script>

<ChatPicker
  bind:this={picker}
  items={emojis}
  key={(emoji) => emoji.name}
  label={m.chat_emoji()}
  empty=""
  {onpick}
  {oncancel}>
  {#snippet row(emoji, highlighted)}
    {@const at = emoji.name.indexOf(typed)}
    <span class="w-7 shrink-0 text-center text-[1.35rem] leading-none"
      >{emoji.emoji}</span>
    <span class="min-w-0 flex-1 truncate font-mono text-sm"
      >:{#if at === -1}{emoji.name}{:else}{emoji.name.slice(0, at)}<b
          class="text-accent">{emoji.name.slice(at, at + typed.length)}</b
        >{emoji.name.slice(at + typed.length)}{/if}:</span>
    <span
      class="text-dim font-mono text-xs transition-opacity duration-150
        {highlighted ? 'opacity-100' : 'opacity-0'}"
      aria-hidden="true">↵</span>
  {/snippet}
</ChatPicker>
