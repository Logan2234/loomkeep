<script lang="ts">
  import Poster from "#lib/components/Poster.svelte";
  import type { WorkThreadDto } from "@loomkeep/shared";
  import {
    workThreadContext,
    workThreadPreview,
    workThreadTime,
  } from "./conversation-presentation";

  let {
    thread,
    active = false,
    onselect,
  }: {
    thread: WorkThreadDto;
    active?: boolean;
    onselect: (thread: WorkThreadDto) => void;
  } = $props();

  const context = $derived(workThreadContext(thread));
</script>

<button
  type="button"
  class="hover:bg-surface-2 relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150
    {active ? 'bg-surface-2' : ''}"
  aria-current={active ? "true" : undefined}
  onclick={() => onselect(thread)}>
  {#if active}
    <span
      class="bg-accent absolute top-1/2 left-0 h-8 w-1 -translate-y-1/2 rounded-r"
      aria-hidden="true"></span>
  {/if}
  <span class="w-9 shrink-0 overflow-hidden rounded-md">
    <Poster src={thread.imageUrl} title={thread.title} alt="" caption={false} />
  </span>
  <span class="min-w-0 flex-1">
    <span class="flex items-baseline justify-between gap-2">
      <span class="truncate font-semibold">{thread.title}</span>
      <span
        class="shrink-0 font-mono text-[0.68rem] {thread.unread
          ? 'text-accent'
          : 'text-dim'}">{workThreadTime(thread)}</span>
    </span>
    {#if context}
      <span
        class="text-accent block font-mono text-[0.62rem] font-bold tracking-wider uppercase">
        {context}
      </span>
    {/if}
    <span
      class="block truncate text-[0.8rem] {thread.unread
        ? 'text-fg'
        : 'text-dim'}">{workThreadPreview(thread)}</span>
  </span>
  {#if thread.unread > 0}
    <span
      class="bg-accent text-accent-fg grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 font-mono text-[0.68rem] font-bold">
      {thread.unread > 99 ? "99+" : thread.unread}
    </span>
  {/if}
</button>
